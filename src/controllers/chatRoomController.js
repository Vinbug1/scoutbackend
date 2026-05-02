import prisma from '../lib/prisma.js';

const chatRoomController = {

  // Create a new ChatRoom
  async create(req, res) {
    try {
      const { name, userIds = [] } = req.body;

      const chatRoom = await prisma.chatRoom.create({
        data: {
          name: name || null,
          // 👇 optionally add members on creation
          members: userIds.length > 0 ? {
            create: userIds.map(userId => ({ userId }))
          } : undefined,
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullname: true, email: true } }
            }
          }
        }
      });

      res.status(201).json({ message: 'Chat room created successfully', data: chatRoom });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create chat room' });
    }
  },

  // Get all ChatRooms
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const [chatRooms, total] = await Promise.all([
        prisma.chatRoom.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            members: {
              include: {
                user: { select: { id: true, fullname: true, email: true } }
              }
            },
            // 👇 only fetch the latest 1 message as preview
            messages: {
              orderBy: { sentAt: 'desc' },
              take: 1,
              include: {
                user: { select: { id: true, fullname: true } }
              }
            },
            _count: { select: { messages: true, members: true } }
          },
        }),
        prisma.chatRoom.count()
      ]);

      res.status(200).json({
        data: chatRooms,
        meta: {
          total,
          page: parseInt(page),
          limit: take,
          totalPages: Math.ceil(total / take),
        }
      });
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

      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullname: true, email: true } }
            }
          },
          messages: {
            orderBy: { sentAt: 'asc' },
            include: {
              user: { select: { id: true, fullname: true } }
            }
          },
          _count: { select: { messages: true, members: true } }
        },
      });

      if (!chatRoom) {
        return res.status(404).json({ error: 'Chat room not found' });
      }

      res.status(200).json({ data: chatRoom });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch chat room' });
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

      const existing = await prisma.chatRoom.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Chat room not found' });
      }

      const updatedChatRoom = await prisma.chatRoom.update({
        where: { id },
        data: { name },
      });

      res.status(200).json({ message: 'Chat room updated successfully', data: updatedChatRoom });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update chat room' });
    }
  },

  // Delete a ChatRoom
  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid chat room ID' });
      }

      const existing = await prisma.chatRoom.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Chat room not found' });
      }

      // 👇 delete messages and members first to avoid FK constraint errors
      await prisma.$transaction([
        prisma.chatMessage.deleteMany({ where: { roomId: id } }),
        prisma.chatRoomMember.deleteMany({ where: { roomId: id } }),
        prisma.chatRoom.delete({ where: { id } }),
      ]);

      res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete chat room' });
    }
  },

  // 👇 Add / remove a member from a room
  async addMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const member = await prisma.chatRoomMember.create({
        data: { roomId, userId },
        include: {
          user: { select: { id: true, fullname: true, email: true } }
        }
      });

      res.status(201).json({ message: 'Member added successfully', data: member });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'User is already a member of this room' });
      }
      res.status(500).json({ error: 'Failed to add member' });
    }
  },

  async removeMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      await prisma.chatRoomMember.delete({
        where: { roomId_userId: { roomId, userId } }
      });

      res.status(200).json({ message: 'Member removed successfully' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Member not found in this room' });
      }
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
};

export default chatRoomController;