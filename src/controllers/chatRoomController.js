import prisma from '../lib/prisma.js';
import chatRoomService from '../services/chatRoomService.js';

// Confirms the requesting user actually belongs to the room before letting
// them mutate it. Without this, any authenticated user could rename, delete,
// or add/remove members from any room just by guessing its numeric id.
async function assertIsMember(roomId, userId) {
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!membership) {
    const error = new Error('You are not a member of this room');
    error.statusCode = 403;
    throw error;
  }
}

const chatRoomController = {

  async create(req, res) {
    try {
      const creatorId = req.user.id;
      const { name, userIds = [] } = req.body;

      // Make sure the creator is always included as a member, even if the
      // frontend forgot to add their own id to the list.
      const memberIds = userIds.includes(creatorId) ? userIds : [...userIds, creatorId];

      const chatRoom = await chatRoomService.create({
        name,
        userIds: memberIds,
        creatorId
      });

      res.status(201).json({
        message: 'Chat room created successfully',
        data: chatRoom
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create chat room' });
    }
  },

  async findOrCreateDirect(req, res) {
    try {
      const userId = req.user.id;
      const { otherUserId } = req.body;

      const chatRoom = await chatRoomService.findOrCreateDirect({
        userId,
        otherUserId
      });

      res.status(200).json({ data: chatRoom });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to start conversation'
      });
    }
  },

  // Admin/moderation only — returns every room in the system, not just the
  // requesting user's own. Regular clients should call getForUser instead.
  async getAll(req, res) {
    try {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { page = 1, limit = 10 } = req.query;

      const result = await chatRoomService.getAll({ page, limit });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch chat rooms' });
    }
  },

  async getForUser(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const conversations = await chatRoomService.getForUser({
        userId,
        page,
        limit
      });

      res.status(200).json({ data: conversations });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  },

  async getById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;

      await assertIsMember(id, userId);

      const chatRoom = await chatRoomService.getById(id);

      res.status(200).json({ data: chatRoom });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to fetch chat room'
      });
    }
  },

  async update(req, res) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const { name } = req.body;

      await assertIsMember(id, userId);

      const updated = await chatRoomService.update(id, { name });

      res.status(200).json({
        message: 'Chat room updated successfully',
        data: updated
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to update chat room'
      });
    }
  },

  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;

      await assertIsMember(id, userId);

      await chatRoomService.delete(id);

      res.status(200).json({ message: 'Chat room deleted successfully' });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to delete chat room'
      });
    }
  },

  async addMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const requesterId = req.user.id;
      const { userId } = req.body;

      await assertIsMember(roomId, requesterId);

      const member = await chatRoomService.addMember(roomId, { userId });

      res.status(201).json({
        message: 'Member added successfully',
        data: member
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to add member'
      });
    }
  },

  async removeMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      const requesterId = req.user.id;

      await assertIsMember(roomId, requesterId);

      // Allow removing yourself (leaving the room) or, if you later add a
      // "creator" permission model, restrict removing *others* to the room
      // creator only. For now this permits any member to remove any other
      // member — tighten this if that's not the product behavior you want.

      await chatRoomService.removeMember(roomId, targetUserId);

      res.status(200).json({ message: 'Member removed successfully' });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to remove member'
      });
    }
  },
};

export default chatRoomController;





















// import chatRoomService from '../services/chatRoomService.js';

// const chatRoomController = {

//   async create(req, res) {
//     try {
//       const { name, userIds = [] } = req.body;

//       const chatRoom = await chatRoomService.create({
//         name,
//         userIds
//       });

//       res.status(201).json({
//         message: 'Chat room created successfully',
//         data: chatRoom
//       });

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to create chat room' });
//     }
//   },

//   async findOrCreateDirect(req, res) {
//     try {
//       const userId = req.user.id;
//       const { otherUserId } = req.body;

//       const chatRoom = await chatRoomService.findOrCreateDirect({
//         userId,
//         otherUserId
//       });

//       res.status(200).json({ data: chatRoom });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to start conversation'
//       });
//     }
//   },

//   async getAll(req, res) {
//     try {
//       const { page = 1, limit = 10 } = req.query;

//       const result = await chatRoomService.getAll({ page, limit });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to fetch chat rooms' });
//     }
//   },

//   async getForUser(req, res) {
//     try {
//       const userId = req.user.id;
//       const { page = 1, limit = 20 } = req.query;

//       const conversations = await chatRoomService.getForUser({
//         userId,
//         page,
//         limit
//       });

//       res.status(200).json({ data: conversations });

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to fetch conversations' });
//     }
//   },

//   async getById(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       const chatRoom = await chatRoomService.getById(id);

//       res.status(200).json({ data: chatRoom });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to fetch chat room'
//       });
//     }
//   },

//   async update(req, res) {
//     try {
//       const id = parseInt(req.params.id);
//       const { name } = req.body;

//       const updated = await chatRoomService.update(id, { name });

//       res.status(200).json({
//         message: 'Chat room updated successfully',
//         data: updated
//       });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to update chat room'
//       });
//     }
//   },

//   async delete(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       await chatRoomService.delete(id);

//       res.status(200).json({ message: 'Chat room deleted successfully' });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to delete chat room'
//       });
//     }
//   },

//   async addMember(req, res) {
//     try {
//       const roomId = parseInt(req.params.id);
//       const { userId } = req.body;

//       const member = await chatRoomService.addMember(roomId, { userId });

//       res.status(201).json({
//         message: 'Member added successfully',
//         data: member
//       });

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to add member' });
//     }
//   },

//   async removeMember(req, res) {
//     try {
//       const roomId = parseInt(req.params.id);
//       const userId = parseInt(req.params.userId);

//       await chatRoomService.removeMember(roomId, userId);

//       res.status(200).json({ message: 'Member removed successfully' });

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to remove member' });
//     }
//   },
// };

// export default chatRoomController;
