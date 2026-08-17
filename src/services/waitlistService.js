import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';

const waitlistService = {
  async verifyTurnstile(token, ip) {
    if (!token) {
      const error = new Error('CAPTCHA token is required');
      error.statusCode = 400;
      throw error;
    }

    if (!process.env.TURNSTILE_SECRET_KEY) {
      const error = new Error('TURNSTILE_SECRET_KEY is not configured');
      error.statusCode = 500;
      throw error;
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: ip,
        }),
      }
    );

    if (!response.ok) {
      const error = new Error('CAPTCHA verification service unavailable');
      error.statusCode = 502;
      throw error;
    }

    const result = await response.json();

    // Turnstile tokens must be checked on the server before processing
    // the waitlist submission. The token should never be stored in the DB.
    if (!result.success) {
      const error = new Error('CAPTCHA verification failed');
      error.statusCode = 400;
      throw error;
    }

    return result;
  },

  hashIp(ip) {
    if (!process.env.IP_HASH_SECRET) {
      const error = new Error('IP_HASH_SECRET is not configured');
      error.statusCode = 500;
      throw error;
    }

    return crypto
      .createHash('sha256')
      .update(`${ip}:${process.env.IP_HASH_SECRET}`)
      .digest('hex');
  },

  async join({
    email,
    fullname,
    role,
    country,
    phone,
    consent,
    source,
    turnstileToken,
    ip,
    userAgent,
  }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      const error = new Error('A valid email is required');
      error.statusCode = 400;
      throw error;
    }

    if (consent !== true) {
      const error = new Error('Consent is required');
      error.statusCode = 400;
      throw error;
    }

    // Verify CAPTCHA before checking/saving the waitlist data.
    await waitlistService.verifyTurnstile(turnstileToken, ip);

    const existing = await prisma.waitlistEntry.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return {
        message: 'This email is already on the waitlist',
        alreadyJoined: true,
        data: {
          id: existing.id,
          email: existing.email,
          status: existing.status,
        },
      };
    }

    try {
      const entry = await prisma.waitlistEntry.create({
        data: {
          email: normalizedEmail,
          fullname: fullname ? String(fullname).trim() : null,
          role: role || null,
          country: country ? String(country).trim() : null,
          phone: phone ? String(phone).trim() : null,
          consent: true,
          source: source ? String(source).trim() : 'landing_page',
          ipHash: waitlistService.hashIp(ip),
          userAgent: userAgent || null,
        },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          country: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        message: 'You have successfully joined the waitlist',
        alreadyJoined: false,
        data: entry,
      };
    } catch (err) {
      // Handles two simultaneous submissions with the same email.
      if (err.code === 'P2002') {
        const error = new Error('This email is already on the waitlist');
        error.statusCode = 409;
        throw error;
      }

      throw err;
    }
  },

  async getAll({ page = 1, limit = 20, status } = {}) {
    const currentPage = Math.max(1, parseInt(page));
    const take = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (currentPage - 1) * take;

    const where = status ? { status } : {};

    const [entries, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          country: true,
          phone: true,
          status: true,
          source: true,
          consent: true,
          createdAt: true,
          updatedAt: true,
          invitedAt: true,
        },
      }),

      prisma.waitlistEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page: currentPage,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  },

  async getById(id) {
    id = parseInt(id);

    const entry = await prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      const error = new Error('Waitlist entry not found');
      error.statusCode = 404;
      throw error;
    }

    return entry;
  },

  async updateStatus(id, status) {
    id = parseInt(id);

    const validStatuses = [
      'WAITING',
      'INVITED',
      'JOINED',
      'UNSUBSCRIBED',
    ];

    if (!validStatuses.includes(status)) {
      const error = new Error('Invalid waitlist status');
      error.statusCode = 400;
      throw error;
    }

    const existing = await prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      const error = new Error('Waitlist entry not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.waitlistEntry.update({
      where: { id },
      data: {
        status,
        invitedAt: status === 'INVITED' ? new Date() : existing.invitedAt,
      },
    });
  },

  async remove(id) {
    id = parseInt(id);

    const existing = await prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      const error = new Error('Waitlist entry not found');
      error.statusCode = 404;
      throw error;
    }

    await prisma.waitlistEntry.delete({
      where: { id },
    });

    return {
      message: 'Waitlist entry deleted',
    };
  },
};

export default waitlistService;