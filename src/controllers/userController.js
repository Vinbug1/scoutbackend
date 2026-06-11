import userService from '../services/userService.js';

const UserController = {

  // ===========================
  // AUTH
  // ===========================
  async register(req, res) {
    try {
      const result = await userService.register(req.body);
      res.status(201).json({ message: 'Registration successful', ...result });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async login(req, res) {
    try {
      const result = await userService.login(req.body);
      res.status(200).json({ message: 'Login successful', ...result });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  // ===========================
  // OTP
  // ===========================
  async verifyOTP(req, res) {
    try {
      await userService.verifyOTP(req.body);
      res.status(200).json({ message: 'Account verified successfully!' });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async resendOTP(req, res) {
    try {
      await userService.resendOTP(req.body);
      res.status(200).json({ message: 'A new OTP has been sent to your email.' });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  // ===========================
  // PASSWORD
  // ===========================
  async forgotPassword(req, res) {
    try {
      await userService.forgotPassword(req.body);
      // Always return the same message whether email exists or not
      res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async verifyResetOTP(req, res) {
    try {
      const resetToken = await userService.verifyResetOTP(req.body);
      res.status(200).json({
        message: 'OTP verified. Use the reset token to set a new password.',
        resetToken,
      });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async resetPassword(req, res) {
    try {
      await userService.resetPassword(req.body);
      res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async updatePassword(req, res) {
    try {
      await userService.updatePassword({ userId: req.user.userId, ...req.body });
      res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  // ===========================
  // CRUD
  // ===========================
  async getCurrentUser(req, res) {
    try {
      const user = await userService.getCurrentUser(req.user.userId);
      res.status(200).json(user);
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async getUsers(req, res) {
    try {
      const users = await userService.getAll();
      res.status(200).json(users);
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async getUserById(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid user ID' });

      const user = await userService.getById(id);
      res.status(200).json(user);
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async updateUser(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid user ID' });

      const updated = await userService.update(id, req.body);
      res.status(200).json(updated);
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },

  async deleteUser(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid user ID' });

      await userService.delete(id);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Server error' });
    }
  },
};

export default UserController;


