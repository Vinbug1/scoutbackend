import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const ChatMessageController = {
  // CREATE a new chat message
  async createMessage(req, res) {
    const { roomId, userId, message } = req.body;
    if (!roomId || !userId || !message) {
      return res.status(400).json({ error: "roomId, userId and message are required" });
    }
    try {
      const newMessage = await prisma.chatMessage.create({
        data: { roomId, userId, message },
        include: { user: true, room: true },
      });
      res.status(201).json(newMessage);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create message" });
    }
  },

  // READ all messages (optionally filter by roomId)
  async getMessages(req, res) {
    const { roomId } = req.query;
    try {
      const messages = await prisma.chatMessage.findMany({
        where: roomId ? { roomId: parseInt(roomId) } : {},
        include: { user: true, room: true },
        orderBy: { sentAt: 'asc' },
      });
      res.json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },

  // READ a single message by ID
  async getMessageById(req, res) {
    const { id } = req.params;
    try {
      const message = await prisma.chatMessage.findUnique({
        where: { id: parseInt(id) },
        include: { user: true, room: true },
      });
      if (!message) return res.status(404).json({ error: "Message not found" });
      res.json(message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch message" });
    }
  },

  // UPDATE a message
  async updateMessage(req, res) {
    const { id } = req.params;
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message content is required" });
    }
    try {
      const updatedMessage = await prisma.chatMessage.update({
        where: { id: parseInt(id) },
        data: { message },
        include: { user: true, room: true },
      });
      res.json(updatedMessage);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update message" });
    }
  },

  // DELETE a message
  async deleteMessage(req, res) {
    const { id } = req.params;
    try {
      await prisma.chatMessage.delete({ where: { id: parseInt(id) } });
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  }
};

export default ChatMessageController;