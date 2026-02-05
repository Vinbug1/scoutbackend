import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const chatRoomController = {
  // Create a new ChatRoom
  async create(req, res) {
    try {
      const { name } = req.body;
      const chatRoom = await prisma.chatRoom.create({
        data: { name: name || null },
      });
      res.status(201).json(chatRoom);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create chat room' });
    }
  },

  // Get all ChatRooms
  async getAll(req, res) {
    try {
      const chatRooms = await prisma.chatRoom.findMany({
        include: { messages: true },
      });
      res.status(200).json(chatRooms);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch chat rooms' });
    }
  },

  // Get a single ChatRoom by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id: parseInt(id) },
        include: { messages: true },
      });
      if (!chatRoom) {
        return res.status(404).json({ error: 'Chat room not found' });
      }
      res.status(200).json(chatRoom);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch chat room' });
    }
  },

  // Update a ChatRoom
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const updatedChatRoom = await prisma.chatRoom.update({
        where: { id: parseInt(id) },
        data: { name },
      });
      res.status(200).json(updatedChatRoom);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Chat room not found' });
      }
      res.status(500).json({ error: 'Failed to update chat room' });
    }
  },

  // Delete a ChatRoom
  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.chatRoom.delete({
        where: { id: parseInt(id) },
      });
      res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Chat room not found' });
      }
      res.status(500).json({ error: 'Failed to delete chat room' });
    }
  },
};

export default chatRoomController;