import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../config/nodemailer.js';

const VALID_ROLES = ['PLAYER', 'SCOUT', 'ADMIN'];
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const userService = {

  // ===========================
  // AUTH
  // ===========================
  async register({ email, password, fullname, role }) {
    if (!email || !password || !fullname) {
      throw { status: 400, message: 'Email, password, and fullname are required' };
    }
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw { status: 400, message: 'Invalid email format' };
    }
  
    if (password.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters long' };
    }
  
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw { status: 400, message: 'Email already in use' };
  
    const roleUpper = role?.toUpperCase() || 'PLAYER';
    if (!VALID_ROLES.includes(roleUpper)) {
      throw { status: 400, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` };
    }
  
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  
    // ✅ Only change is here
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullname,
        role: roleUpper,
        otp,
        otpExpiry,
        isVerified: false,
  
        ...(roleUpper === 'PLAYER' && { profile: { create: {} } }),
        ...(roleUpper === 'SCOUT' && { scoutProfile: { create: {} } }),
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        createdAt: true,
        profile: true,
        scoutProfile: true,
      },
    });
  
    await sendEmail({
      to: email,
      subject: 'Verify Your Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #333;">Welcome, ${fullname}! 👋</h2>
          <p style="color: #555;">Use the code below to verify your account. It expires in <strong>10 minutes</strong>.</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; text-align: center; padding: 16px 0;">${otp}</div>
          <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });
  
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  
    return { user, token };
  },
  async login({ email, password }) {
    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required' };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, fullname: true, role: true, createdAt: true },
    });

    if (!user) throw { status: 401, message: 'Invalid email or password' };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw { status: 401, message: 'Invalid email or password' };

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  },

  // ===========================
  // OTP
  // ===========================
  async verifyOTP({ email, otp }) {
    if (!email || !otp) throw { status: 400, message: 'Email and OTP are required' };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, otp: true, otpExpiry: true, isVerified: true },
    });

    if (!user) throw { status: 404, message: 'User not found' };
    if (user.isVerified) throw { status: 400, message: 'Account is already verified' };
    if (user.otp !== otp) throw { status: 400, message: 'Invalid OTP' };
    if (new Date() > new Date(user.otpExpiry)) {
      throw { status: 400, message: 'OTP has expired. Please request a new one.' };
    }

    await prisma.user.update({
      where: { email },
      data: { isVerified: true, otp: null, otpExpiry: null },
    });
  },

  async resendOTP({ email }) {
    if (!email) throw { status: 400, message: 'Email is required' };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw { status: 404, message: 'User not found' };
    if (user.isVerified) throw { status: 400, message: 'Account is already verified' };

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({ where: { email }, data: { otp, otpExpiry } });

    await sendEmail({
      to: email,
      subject: 'Your New Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #333;">New Verification Code</h2>
          <p style="color: #555;">Here is your new code. It expires in <strong>10 minutes</strong>.</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; text-align: center; padding: 16px 0;">${otp}</div>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
  },

  // ===========================
  // PASSWORD
  // ===========================
  async forgotPassword({ email }) {
    if (!email) throw { status: 400, message: 'Email is required' };

    const user = await prisma.user.findUnique({ where: { email } });
    // Silently return if user not found — security best practice
    if (!user) return;

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({ where: { email }, data: { otp, otpExpiry } });

    await sendEmail({
      to: email,
      subject: 'Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #555;">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; text-align: center; padding: 16px 0;">${otp}</div>
          <p style="color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
  },

  async verifyResetOTP({ email, otp }) {
    if (!email || !otp) throw { status: 400, message: 'Email and OTP are required' };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, otp: true, otpExpiry: true },
    });

    if (!user) throw { status: 404, message: 'User not found' };
    if (user.otp !== otp) throw { status: 400, message: 'Invalid OTP' };
    if (new Date() > new Date(user.otpExpiry)) {
      throw { status: 400, message: 'OTP has expired. Please request a new one.' };
    }

    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpiry: null },
    });

    return resetToken;
  },

  async resetPassword({ resetToken, newPassword }) {
    if (!resetToken || !newPassword) {
      throw { status: 400, message: 'Reset token and new password are required' };
    }
    if (newPassword.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters long' };
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch {
      throw { status: 401, message: 'Invalid or expired reset token. Please start over.' };
    }

    if (decoded.purpose !== 'password-reset') {
      throw { status: 401, message: 'Invalid reset token' };
    }

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) throw { status: 404, message: 'User not found' };

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { email: decoded.email }, data: { password: hashedPassword } });

    await sendEmail({
      to: decoded.email,
      subject: 'Password Changed Successfully',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #333;">Password Updated ✅</h2>
          <p style="color: #555;">Your password has been changed successfully. If you did not make this change, please contact support immediately.</p>
        </div>
      `,
    });
  },

  async updatePassword({ userId, currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
      throw { status: 400, message: 'Current password and new password are required' };
    }
    if (newPassword.length < 6) {
      throw { status: 400, message: 'New password must be at least 6 characters long' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, email: true, fullname: true },
    });
    if (!user) throw { status: 404, message: 'User not found' };

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw { status: 401, message: 'Current password is incorrect' };

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) throw { status: 400, message: 'New password must be different from current password' };

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

    await sendEmail({
      to: user.email,
      subject: 'Password Changed Successfully',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #333;">Hi ${user.fullname},</h2>
          <p style="color: #555;">Your password was just changed. If this wasn't you, please contact support immediately.</p>
        </div>
      `,
    });
  },

  // ===========================
  // CRUD
  // ===========================
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullname: true, role: true, createdAt: true, profile: true },
    });
    if (!user) throw { status: 404, message: 'User not found' };
    return user;
  },

  async getAll() {
    return prisma.user.findMany({
      select: {
        id: true, email: true, fullname: true, role: true, createdAt: true,
        profile: true,
        _count: { select: { posts: true, followers: true, following: true, videos: true } },
      },
    });
  },

  async getById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, fullname: true, role: true, createdAt: true,
        profile: true, videos: true, posts: true,
        _count: { select: { followers: true, following: true, videos: true, posts: true, comments: true } },
      },
    });
    if (!user) throw { status: 404, message: 'User not found' };
    return user;
  },

  async update(id, { email, password, fullname, role }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw { status: 404, message: 'User not found' };

    if (role) {
      const roleUpper = role.toUpperCase();
      if (!VALID_ROLES.includes(roleUpper)) {
        throw { status: 400, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` };
      }
    }

    let hashedPassword = user.password;
    if (password) hashedPassword = await bcrypt.hash(password, 10);

    return prisma.user.update({
      where: { id },
      data: {
        email: email ?? user.email,
        password: hashedPassword,
        fullname: fullname ?? user.fullname,
        role: role ? role.toUpperCase() : user.role,
      },
      select: { id: true, email: true, fullname: true, role: true, createdAt: true },
    });
  },

  async delete(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw { status: 404, message: 'User not found' };
    await prisma.user.delete({ where: { id } });
  },
};

export default userService;