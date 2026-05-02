import prisma from '../lib/prisma.js';

const ChatMessageController = {

  // CREATE a new chat message
  async createMessage(req, res) {
    try {
      const { roomId, userId, message } = req.body;

      if (!roomId || !userId || !message) {
        return res.status(400).json({ error: 'roomId, userId and message are required' });
      }

      // 👇 Guard: make sure room exists
      const room = await prisma.chatRoom.findUnique({ where: { id: parseInt(roomId) } });
      if (!room) {
        return res.status(404).json({ error: 'Chat room not found' });
      }

      const newMessage = await prisma.chatMessage.create({
        data: {
          roomId: parseInt(roomId),
          userId: parseInt(userId),
          message
        },
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          room: { select: { id: true, name: true } }
        },
      });

      res.status(201).json({ message: 'Message sent successfully', data: newMessage });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  },

  // GET all messages (filter by roomId, pagination)
  async getMessages(req, res) {
    try {
      const { roomId, page = 1, limit = 20 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const where = roomId ? { roomId: parseInt(roomId) } : {};

      const [messages, total] = await Promise.all([
        prisma.chatMessage.findMany({
          where,
          skip,
          take,
          orderBy: { sentAt: 'asc' },
          include: {
            user: { select: { id: true, fullname: true, email: true } },
            room: { select: { id: true, name: true } }
          },
        }),
        prisma.chatMessage.count({ where })
      ]);

      res.status(200).json({
        data: messages,
        meta: {
          total,
          page: parseInt(page),
          limit: take,
          totalPages: Math.ceil(total / take),
        }
      });
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

      const message = await prisma.chatMessage.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          room: { select: { id: true, name: true } }
        },
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.status(200).json({ data: message });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch message' });
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

      // 👇 Guard: check message exists
      const existing = await prisma.chatMessage.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const updatedMessage = await prisma.chatMessage.update({
        where: { id },
        data: { message },
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          room: { select: { id: true, name: true } }
        },
      });

      res.status(200).json({ message: 'Message updated successfully', data: updatedMessage });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update message' });
    }
  },

  // DELETE a message
  async deleteMessage(req, res) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      const existing = await prisma.chatMessage.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Message not found' });
      }

      await prisma.chatMessage.delete({ where: { id } });
      res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
};

export default ChatMessageController;