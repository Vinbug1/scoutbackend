import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const PaymentController = {
  // Create a new payment
  async createPayment(req, res) {
    try {
      const { userId, amount, currency, status, providerRef } = req.body;
      const payment = await prisma.payment.create({
        data: {
          userId,
          amount,
          currency: currency || "USD",
          status: status || PaymentStatus.PENDING,
          providerRef,
        },
      });
      res.status(201).json(payment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create payment." });
    }
  },

  // Get all payments
  async getAllPayments(req, res) {
    try {
      const payments = await prisma.payment.findMany({
        include: { user: true },
      });
      res.json(payments);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch payments." });
    }
  },

  // Get payment by ID
  async getPaymentById(req, res) {
    const id = parseInt(req.params.id);
    try {
      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!payment)
        return res.status(404).json({ error: "Payment not found." });
      res.json(payment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch payment." });
    }
  },

  // Update payment by ID
  async updatePayment(req, res) {
    const id = parseInt(req.params.id);
    const { amount, currency, status, providerRef } = req.body;
    try {
      const payment = await prisma.payment.update({
        where: { id },
        data: { amount, currency, status, providerRef },
      });
      res.json(payment);
    } catch (error) {
      console.error(error);
      if (error.code === "P2025")
        return res.status(404).json({ error: "Payment not found." });
      res.status(500).json({ error: "Failed to update payment." });
    }
  },

  // Delete payment by ID
  async deletePayment(req, res) {
    const id = parseInt(req.params.id);
    try {
      await prisma.payment.delete({ where: { id } });
      res.json({ message: "Payment deleted successfully." });
    } catch (error) {
      console.error(error);
      if (error.code === "P2025")
        return res.status(404).json({ error: "Payment not found." });
      res.status(500).json({ error: "Failed to delete payment." });
    }
  }
};

export default PaymentController;