import prisma from '../lib/prisma.js';

const paymentService = {

  async createPayment({ userId, amount, currency, status, providerRef }) {
    return prisma.payment.create({
      data: {
        userId,
        amount,
        currency: currency || 'USD',
        status: status || 'PENDING',
        providerRef,
      },
    });
  },

  async getAllPayments() {
    return prisma.payment.findMany({
      include: { user: true },
    });
  },

  async getPaymentById(id) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!payment) {
      const error = new Error('Payment not found.');
      error.statusCode = 404;
      throw error;
    }

    return payment;
  },

  async updatePayment(id, { amount, currency, status, providerRef }) {
    return prisma.payment.update({
      where: { id },
      data: { amount, currency, status, providerRef },
    });
  },

  async deletePayment(id) {
    return prisma.payment.delete({ where: { id } });
  }
};

export default paymentService;