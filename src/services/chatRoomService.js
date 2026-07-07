import prisma from '../lib/prisma.js';

const chatRoomService = {

  async create({ name, userIds = [] }) {
    return prisma.chatRoom.create({
      data: {
        name: name || null,
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
  },

  // Find an existing 1:1 room between two users, or create one.
  // This is what the "message this scout/player" button should call —
  // it prevents duplicate rooms between the same pair of users.
  //
  // IMPORTANT: `userId` must come from the authenticated request
  // (e.g. req.user.id from JWT middleware), never from the request body —
  // otherwise a client could impersonate any user in the pairing.
  // `otherUserId` is safe to take from the frontend (e.g. a profile id).
  async findOrCreateDirect({ userId, otherUserId }) {
    userId = parseInt(userId);
    otherUserId = parseInt(otherUserId);

    if (userId === otherUserId) {
      const error = new Error('Cannot start a conversation with yourself');
      error.statusCode = 400;
      throw error;
    }

    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
    });
    if (blocked) {
      const error = new Error('Cannot start a conversation with this user');
      error.statusCode = 403;
      throw error;
    }

    // Deterministic key regardless of who calls it first — smaller id always
    // goes first, so (A,B) and (B,A) resolve to the same room.
    const [a, b] = [userId, otherUserId].sort((x, y) => x - y);
    const directKey = `${a}_${b}`;

    // upsert is atomic at the DB level, so two simultaneous calls for the
    // same pair (e.g. both users tap "message" at once) safely collapse to
    // one room instead of racing past a findFirst check.
    const room = await prisma.chatRoom.upsert({
      where: { directKey },
      update: {}, // no-op if it already exists — this IS the dedupe
      create: {
        type: 'DIRECT',
        directKey,
        members: { create: [{ userId }, { userId: otherUserId }] },
      },
      include: {
        members: { include: { user: { select: { id: true, fullname: true, email: true } } } },
      },
    });

    return room;
  },

  async getAll({ page = 1, limit = 10 }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [chatRooms, total] = await Promise.all([
      prisma.chatRoom.findMany({
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } }
            }
          },
          lastMessage: {
            include: { user: { select: { id: true, fullname: true } } }
          },
          _count: { select: { messages: true, members: true } }
        },
      }),
      prisma.chatRoom.count()
    ]);

    return {
      data: chatRooms,
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      }
    };
  },

  // Rooms for a specific user, with their personal unread count attached —
  // this is what the "conversation list" screen should call, not getAll().
  async getForUser({ userId, page = 1, limit = 20 }) {
    userId = parseInt(userId);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const memberships = await prisma.chatRoomMember.findMany({
      where: { userId },
      skip,
      take,
      orderBy: { room: { updatedAt: 'desc' } },
      include: {
        room: {
          include: {
            members: {
              include: { user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } } }
            },
            lastMessage: {
              include: { user: { select: { id: true, fullname: true } } }
            },
          },
        },
      },
    });

    return memberships.map(m => ({
      roomId: m.room.id,
      name: m.room.name,
      participants: m.room.members.filter(mem => mem.userId !== userId).map(mem => mem.user),
      lastMessage: m.room.lastMessage,
      unreadCount: m.unreadCount,
      updatedAt: m.room.updatedAt,
    }));
  },

  async getById(id) {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } }
          }
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { sentAt: 'asc' },
          include: {
            user: { select: { id: true, fullname: true } }
          }
        },
        _count: { select: { messages: true, members: true } }
      },
    });

    if (!chatRoom) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    return chatRoom;
  },

  async update(id, { name }) {
    const existing = await prisma.chatRoom.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.chatRoom.update({
      where: { id },
      data: { name },
    });
  },

  async delete(id) {
    const existing = await prisma.chatRoom.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    // Clear the lastMessage pointer first — it's an FK into ChatMessage,
    // and would block the message delete below otherwise.
    await prisma.$transaction([
      prisma.chatRoom.update({ where: { id }, data: { lastMessageId: null } }),
      prisma.messageRead.deleteMany({ where: { message: { roomId: id } } }),
      prisma.chatMessage.deleteMany({ where: { roomId: id } }),
      prisma.chatRoomMember.deleteMany({ where: { roomId: id } }),
      prisma.chatRoom.delete({ where: { id } }),
    ]);
  },

  async addMember(roomId, { userId }) {
    try {
      return await prisma.chatRoomMember.create({
        data: { roomId, userId },
        include: {
          user: { select: { id: true, fullname: true, email: true } }
        }
      });
    } catch (err) {
      if (err.code === 'P2002') {
        const error = new Error('User is already a member of this room');
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  },

  async removeMember(roomId, userId) {
    return prisma.chatRoomMember.delete({
      where: { roomId_userId: { roomId, userId } }
    });
  }
};

export default chatRoomService;














// import prisma from '../lib/prisma.js';

// const chatRoomService = {

//   async create({ name, userIds = [] }) {
//     return prisma.chatRoom.create({
//       data: {
//         name: name || null,
//         members: userIds.length > 0 ? {
//           create: userIds.map(userId => ({ userId }))
//         } : undefined,
//       },
//       include: {
//         members: {
//           include: {
//             user: { select: { id: true, fullname: true, email: true } }
//           }
//         }
//       }
//     });
//   },

//   // Find an existing 1:1 room between two users, or create one.
//   // This is what the "message this scout/player" button should call —
//   // it prevents duplicate rooms between the same pair of users.
//   async findOrCreateDirect({ userId, otherUserId }) {
//     userId = parseInt(userId);
//     otherUserId = parseInt(otherUserId);

//     if (userId === otherUserId) {
//       const error = new Error('Cannot start a conversation with yourself');
//       error.statusCode = 400;
//       throw error;
//     }

//     const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
//     if (!otherUser) {
//       const error = new Error('User not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     const blocked = await prisma.block.findFirst({
//       where: {
//         OR: [
//           { blockerId: userId, blockedId: otherUserId },
//           { blockerId: otherUserId, blockedId: userId },
//         ],
//       },
//     });
//     if (blocked) {
//       const error = new Error('Cannot start a conversation with this user');
//       error.statusCode = 403;
//       throw error;
//     }

//     const existing = await prisma.chatRoom.findFirst({
//       where: {
//         AND: [
//           { members: { some: { userId } } },
//           { members: { some: { userId: otherUserId } } },
//         ],
//       },
//       include: {
//         members: { include: { user: { select: { id: true, fullname: true, email: true } } } },
//       },
//     });

//     if (existing) return existing;

//     return prisma.chatRoom.create({
//       data: {
//         members: { create: [{ userId }, { userId: otherUserId }] },
//       },
//       include: {
//         members: { include: { user: { select: { id: true, fullname: true, email: true } } } },
//       },
//     });
//   },

//   async getAll({ page = 1, limit = 10 }) {
//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);

//     const [chatRooms, total] = await Promise.all([
//       prisma.chatRoom.findMany({
//         skip,
//         take,
//         orderBy: { updatedAt: 'desc' },
//         include: {
//           members: {
//             include: {
//               user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } }
//             }
//           },
//           lastMessage: {
//             include: { user: { select: { id: true, fullname: true } } }
//           },
//           _count: { select: { messages: true, members: true } }
//         },
//       }),
//       prisma.chatRoom.count()
//     ]);

//     return {
//       data: chatRooms,
//       meta: {
//         total,
//         page: parseInt(page),
//         limit: take,
//         totalPages: Math.ceil(total / take),
//       }
//     };
//   },

//   // Rooms for a specific user, with their personal unread count attached —
//   // this is what the "conversation list" screen should call, not getAll().
//   async getForUser({ userId, page = 1, limit = 20 }) {
//     userId = parseInt(userId);
//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);

//     const memberships = await prisma.chatRoomMember.findMany({
//       where: { userId },
//       skip,
//       take,
//       orderBy: { room: { updatedAt: 'desc' } },
//       include: {
//         room: {
//           include: {
//             members: {
//               include: { user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } } }
//             },
//             lastMessage: {
//               include: { user: { select: { id: true, fullname: true } } }
//             },
//           },
//         },
//       },
//     });

//     return memberships.map(m => ({
//       roomId: m.room.id,
//       name: m.room.name,
//       participants: m.room.members.filter(mem => mem.userId !== userId).map(mem => mem.user),
//       lastMessage: m.room.lastMessage,
//       unreadCount: m.unreadCount,
//       updatedAt: m.room.updatedAt,
//     }));
//   },

//   async getById(id) {
//     const chatRoom = await prisma.chatRoom.findUnique({
//       where: { id },
//       include: {
//         members: {
//           include: {
//             user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } }
//           }
//         },
//         messages: {
//           where: { deletedAt: null },
//           orderBy: { sentAt: 'asc' },
//           include: {
//             user: { select: { id: true, fullname: true } }
//           }
//         },
//         _count: { select: { messages: true, members: true } }
//       },
//     });

//     if (!chatRoom) {
//       const error = new Error('Chat room not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     return chatRoom;
//   },

//   async update(id, { name }) {
//     const existing = await prisma.chatRoom.findUnique({ where: { id } });
//     if (!existing) {
//       const error = new Error('Chat room not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     return prisma.chatRoom.update({
//       where: { id },
//       data: { name },
//     });
//   },

//   async delete(id) {
//     const existing = await prisma.chatRoom.findUnique({ where: { id } });
//     if (!existing) {
//       const error = new Error('Chat room not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     // Clear the lastMessage pointer first — it's an FK into ChatMessage,
//     // and would block the message delete below otherwise.
//     await prisma.$transaction([
//       prisma.chatRoom.update({ where: { id }, data: { lastMessageId: null } }),
//       prisma.messageRead.deleteMany({ where: { message: { roomId: id } } }),
//       prisma.chatMessage.deleteMany({ where: { roomId: id } }),
//       prisma.chatRoomMember.deleteMany({ where: { roomId: id } }),
//       prisma.chatRoom.delete({ where: { id } }),
//     ]);
//   },

//   async addMember(roomId, { userId }) {
//     return prisma.chatRoomMember.create({
//       data: { roomId, userId },
//       include: {
//         user: { select: { id: true, fullname: true, email: true } }
//       }
//     });
//   },

//   async removeMember(roomId, userId) {
//     return prisma.chatRoomMember.delete({
//       where: { roomId_userId: { roomId, userId } }
//     });
//   }
// };

// export default chatRoomService;