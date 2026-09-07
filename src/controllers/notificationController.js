import notificationService from '../services/notificationService.js.js';
// Same pattern as followerController — reject anything that isn't a
// positive integer before it reaches Prisma.
function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const MAX_LIMIT = 50;

const notificationController = {
  // GET /notifications?page=&limit=
  async list(req, res) {
    try {
      const page = parsePositiveInt(req.query.page) || 1;
      const limit = Math.min(parsePositiveInt(req.query.limit) || 20, MAX_LIMIT);

      const result = await notificationService.list(req.user.id, { page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  },

  // GET /notifications/unread-count
  async unreadCount(req, res) {
    try {
      const data = await notificationService.unreadCount(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  },

  // POST /notifications/:id/read
  async markRead(req, res) {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid notification id' });
      }
      await notificationService.markRead(req.user.id, id);
      // Safe to call more than once — see notificationService.markRead.
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  },

  // POST /notifications/read-all
  async markAllRead(req, res) {
    try {
      await notificationService.markAllRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  },
};

export default notificationController;