import prisma from '../lib/prisma.js';
import chatRoomService from '../services/chatRoomService.js';

// Confirms the requesting user actually belongs to the room before letting
// them mutate it. Still load-bearing here: unlike ChatMessageService,
// chatRoomService's getById/update/delete do NOT check membership
// internally — only addMember/removeMember/updateMemberRole/muteRoom do
// (because those need to check *role*, not just membership, so the check
// lives inside the service for those). This helper covers the rest.
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

// Shared guard for update/delete — admin required for GROUP rooms;
// any current member permitted for DIRECT rooms (no admin concept there).
async function assertCanManageRoom(roomId, userId) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    const error = new Error('Chat room not found');
    error.statusCode = 404;
    throw error;
  }

  const requester = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!requester) {
    const error = new Error('You are not a member of this room');
    error.statusCode = 403;
    throw error;
  }

  if (room.type === 'GROUP' && requester.role !== 'ADMIN') {
    const error = new Error('Only admins can manage this room');
    error.statusCode = 403;
    throw error;
  }
}

const chatRoomController = {

  async create(req, res) {
    try {
      const creatorId = req.user.id;
      const { name, userIds = [] } = req.body;

      // chatRoomService.create() already folds creatorId into the member
      // set itself (dedup'd via Set), so this doesn't strictly need to
      // happen here too — left in as a harmless belt-and-suspenders
      // check in case that ever changes.
      const memberIds = userIds.includes(creatorId) ? userIds : [...userIds, creatorId];

      const chatRoom = await chatRoomService.create({
        name,
        userIds: memberIds,
        creatorId
      });

      const io = req.app.get('io');
      if (io) {
        for (const member of chatRoom.members) {
          io.to(`user:${member.userId}`).emit('conversation:new', { conversation: chatRoom });
        }
      }

      res.status(201).json({
        message: 'Chat room created successfully',
        data: chatRoom
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to create chat room'
      });
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

  // FIX — two bugs here previously:
  //   1. Passed `{ page, limit }`; the service now takes `{ before, limit }`
  //      (keyset pagination on ChatLastMessage.updatedAt — see
  //      chatRoomService.js). `page` was silently ignored, so every
  //      request returned the same first page no matter what the client
  //      asked for.
  //   2. The service now returns `{ data, nextCursor }`, and this was
  //      re-wrapping that whole object as `{ data: <that object> }` —
  //      double nesting. Fixed by destructuring and passing nextCursor
  //      through explicitly so the client can request the next page.
  
  async getForUser(req, res) {
    try {
      const userId = req.user.id;
      const { before, limit = 30 } = req.query;

      const { data, nextCursor } = await chatRoomService.getForUser({
        userId,
        before,
        limit
      });

      res.status(200).json({ data, nextCursor });

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
  
      await assertCanManageRoom(id, userId);
  
      const updated = await chatRoomService.update(id, { name });
      res.status(200).json({ message: 'Chat room updated successfully', data: updated });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to update chat room' });
    }
  },
  
  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
  
      await assertCanManageRoom(id, userId);
  
      await chatRoomService.delete(id);
      res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to delete chat room' });
    }
  },

  // async update(req, res) {
  //   try {
  //     const id = parseInt(req.params.id);
  //     const userId = req.user.id;
  //     const { name } = req.body;

  //     await assertIsMember(id, userId);

  //     const updated = await chatRoomService.update(id, { name });

  //     res.status(200).json({
  //       message: 'Chat room updated successfully',
  //       data: updated
  //     });

  //   } catch (error) {
  //     console.error(error);
  //     const status = error.statusCode || 500;
  //     res.status(status).json({
  //       error: error.statusCode ? error.message : 'Failed to update chat room'
  //     });
  //   }
  // },

  // async delete(req, res) {
  //   try {
  //     const id = parseInt(req.params.id);
  //     const userId = req.user.id;

  //     await assertIsMember(id, userId);

  //     await chatRoomService.delete(id);

  //     res.status(200).json({ message: 'Chat room deleted successfully' });

  //   } catch (error) {
  //     console.error(error);
  //     const status = error.statusCode || 500;
  //     res.status(status).json({
  //       error: error.statusCode ? error.message : 'Failed to delete chat room'
  //     });
  //   }
  // },

  // FIX — chatRoomService.addMember now requires `requesterId` and
  // enforces admin-only internally (see the service audit — this was
  // previously missing entirely, meaning any member could add someone
  // else regardless of role, which violates spec §4.5). The
  // `assertIsMember` call below is now redundant with that internal
  // check but harmless to leave.
  async addMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const requesterId = req.user.id;
      const { userId, role } = req.body;

      // FIX — validate role before it reaches the service/Prisma. An
      // invalid string here would otherwise hit the ChatMemberRole enum
      // constraint at the DB level and surface as an unhandled 500
      // instead of a clean 400.
      if (role !== undefined && !['MEMBER', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'role must be MEMBER or ADMIN' });
      }

      await assertIsMember(roomId, requesterId);

      const member = await chatRoomService.addMember(roomId, requesterId, { userId, role });

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${member.userId}`).emit('conversation:new', { roomId });
        io.to(`room:${roomId}`).emit('conversation:member-added', { roomId, member });
      }

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

  // FIX — this was the hard bug: `chatRoomService.removeMember(roomId,
  // targetUserId)` was calling a 3-arg function `(roomId,
  // requesterUserId, targetUserId)` with only 2 arguments. targetUserId
  // was landing in the requesterUserId parameter slot, and the actual
  // target was undefined — so this endpoint was broken (would either
  // throw or, worse, act on the wrong user) regardless of what role
  // logic the service enforces. Also removed the stale comment about
  // "any member can remove any other member" — the service now enforces
  // admin-only removal-of-others and the last-admin-leave guard itself
  // (spec §4.5/§14.28), so that note no longer describes the behavior.
  async removeMember(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      const requesterId = req.user.id;

      await chatRoomService.removeMember(roomId, requesterId, targetUserId);

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('conversation:member-removed', { roomId, userId: targetUserId });
        io.in(`user:${targetUserId}`).socketsLeave?.(`room:${roomId}`);
      }

      res.status(200).json({ message: 'Member removed successfully' });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to remove member'
      });
    }
  },

  // NEW — spec §4.5's PATCH .../role endpoint (promote/demote). Existed
  // in the service already; nothing was calling it.
  async updateMemberRole(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      const requesterId = req.user.id;
      const { role } = req.body;

      if (!['MEMBER', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'role must be MEMBER or ADMIN' });
      }

      const updated = await chatRoomService.updateMemberRole(roomId, requesterId, targetUserId, role);

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('conversation:role-changed', { roomId, userId: targetUserId, role });
      }

      res.status(200).json({ message: 'Role updated successfully', data: updated });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to update role'
      });
    }
  },

  // NEW — mute/unmute a room for the calling user (spec §12: the
  // push-notification worker checks mutedUntil, but nothing let a user
  // set it).
  async muteRoom(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const userId = req.user.id;
      const { mutedUntil } = req.body; // ISO timestamp, or omit for "mute indefinitely" handling client-side

      const updated = await chatRoomService.muteRoom(roomId, userId, mutedUntil ?? null);

      res.status(200).json({ message: 'Room muted', data: updated });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to mute room'
      });
    }
  },

  async unmuteRoom(req, res) {
    try {
      const roomId = parseInt(req.params.id);
      const userId = req.user.id;

      const updated = await chatRoomService.unmuteRoom(roomId, userId);

      res.status(200).json({ message: 'Room unmuted', data: updated });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to unmute room'
      });
    }
  },
};

export default chatRoomController;
