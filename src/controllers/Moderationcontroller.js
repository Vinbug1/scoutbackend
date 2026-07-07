import ModerationService from '../services/Moderationservice';

const ModerationController = {

  async blockUser(req, res) {
    try {
      const blockerId = req.user.id;
      const { blockedId } = req.body;

      const result = await ModerationService.blockUser({
        blockerId,
        blockedId
      });

      res.status(201).json({
        message: 'User blocked successfully',
        data: result
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to block user'
      });
    }
  },

  async unblockUser(req, res) {
    try {
      const blockerId = req.user.id;
      const { blockedId } = req.body;

      const result = await ModerationService.unblockUser({
        blockerId,
        blockedId
      });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  },

  async listBlocked(req, res) {
    try {
      const blockerId = req.user.id;

      const blocked = await ModerationService.listBlocked(blockerId);

      res.status(200).json({ data: blocked });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  },

  async reportUser(req, res) {
    try {
      const reporterId = req.user.id;
      const { reportedId, reason, messageId } = req.body;

      const result = await ModerationService.reportUser({
        reporterId,
        reportedId,
        reason,
        messageId
      });

      res.status(201).json({
        message: 'Report submitted successfully',
        data: result
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to submit report'
      });
    }
  },
};

export default ModerationController;