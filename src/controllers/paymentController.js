import paymentService from '../services/paymentService.js';

const paymentController = {

  // Create a new payment
  async createPayment(req, res) {
    try {
      const { userId, amount, currency, status, providerRef } = req.body;
      const payment = await paymentService.createPayment({ userId, amount, currency, status, providerRef });
      res.status(201).json(payment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create payment.' });
    }
  },

  // Get all payments
  async getAllPayments(req, res) {
    try {
      const payments = await paymentService.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch payments.' });
    }
  },

  // Get payment by ID
  async getPaymentById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const payment = await paymentService.getPaymentById(id);
      res.json(payment);
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to fetch payment.' });
    }
  },

  // Update payment by ID
  async updatePayment(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { amount, currency, status, providerRef } = req.body;
      const payment = await paymentService.updatePayment(id, { amount, currency, status, providerRef });
      res.json(payment);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Payment not found.' });
      }
      res.status(500).json({ error: 'Failed to update payment.' });
    }
  },

  // Delete payment by ID
  async deletePayment(req, res) {
    try {
      const id = parseInt(req.params.id);
      await paymentService.deletePayment(id);
      res.json({ message: 'Payment deleted successfully.' });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Payment not found.' });
      }
      res.status(500).json({ error: 'Failed to delete payment.' });
    }
  }
};

export default paymentController;