import chatRoomService from '../services/chatRoomService.js';

const chatRoomController = {

  // Create a new ChatRoom
  async create(req, res) {
    try {
      const { name, userIds = [] } = req.body;
      const chatRoom = await chatRoomService.create({ name, userIds });
      res.status(201).json({ message: 'Chat room created successfully', data: chatRoom });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to create chat room' });
    }
  },

  // Get all ChatRooms
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await chatRoomService.getAll({ page, limit });
      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch chat rooms' });
    }
  },

  // Get a single ChatRoom by ID
  async getById(req, res) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid chat room ID' });
      }

      const chatRoom = await chatRoomService.getById(id);
      res.status(200).json({ data: chatRoom });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to fetch chat room' });
    }
  },

  // Update a ChatRoom
  async update(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid chat room ID' });
      }

      const updatedChatRoom = await chatRoomService.update(id, { name });
      res.status(200).json({ message: 'Chat room updated successfully', data: updatedChatRoom });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to update chat room' });
    }
  },

  // Delete a ChatRoom
  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid chat room ID' });
      }

      await chatRoomService.delete(id);
      res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to delete chat room' });
    }
  },

  // Add a member to a room
  async addMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const member = await chatRoomService.addMember(roomId, { userId });
      res.status(201).json({ message: 'Member added successfully', data: member });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'User is already a member of this room' });
      }
      res.status(500).json({ error: 'Failed to add member' });
    }
  },

  // Remove a member from a room
  async removeMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      await chatRoomService.removeMember(roomId, userId);
      res.status(200).json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Member not found in this room' });
      }
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
};

export default chatRoomController;