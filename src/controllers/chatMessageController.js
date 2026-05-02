import ChatMessageService from '../services/chatMessageService.js';

const ChatMessageController = {

  // CREATE a new chat message
  async createMessage(req, res) {
    try {
      const { roomId, userId, message } = req.body;

      if (!roomId || !userId || !message) {
        return res.status(400).json({ error: 'roomId, userId and message are required' });
      }

      const newMessage = await ChatMessageService.createMessage({ roomId, userId, message });
      res.status(201).json({ message: 'Message sent successfully', data: newMessage });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to create message' });
    }
  },

  // GET all messages (filter by roomId, pagination)
  async getMessages(req, res) {
    try {
      const { roomId, page = 1, limit = 20 } = req.query;
      const result = await ChatMessageService.getMessages({ roomId, page, limit });
      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },

  // GET a single message by ID
  async getMessageById(req, res) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      const message = await ChatMessageService.getMessageById(id);
      res.status(200).json({ data: message });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to fetch message' });
    }
  },

  // UPDATE a message
  async updateMessage(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      const updatedMessage = await ChatMessageService.updateMessage(id, { message });
      res.status(200).json({ message: 'Message updated successfully', data: updatedMessage });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to update message' });
    }
  },

  // DELETE a message
  async deleteMessage(req, res) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      await ChatMessageService.deleteMessage(id);
      res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to delete message' });
    }
  },
};

export default ChatMessageController;