import pushTokenService from '../services/pushTokenService.js';

const PushTokenController = {
  async saveToken(req, res, next) {
    try {
      const { token } = req.body;
      const userId = req.user.id;

      const user = await pushTokenService.saveToken(userId, token);

      return res.status(200).json({
        success: true,
        message: 'Push token saved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteToken(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await pushTokenService.deleteToken(userId);

      return res.status(200).json({
        success: true,
        message: 'Push token removed successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default PushTokenController;