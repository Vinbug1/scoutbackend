import prisma from '../lib/prisma.js';

const chatRoomService = {

  // CHANGED — now takes `creatorId` and sets type: 'GROUP' explicitly
  // (previously fell through to the schema default of DIRECT, which
  // doesn't make sense for a named, multi-member room). The creator is
  // made ADMIN; everyone else joins as MEMBER — group membership
  // management (add/remove/promote) has nothing to authorize against
  // without this (spec §4.5).
  async create({ name, creatorId, userIds = [] }) {
    creatorId = creatorId ? parseInt(creatorId) : undefined;
    const memberIds = Array.from(new Set([
      ...(creatorId ? [creatorId] : []),
      ...userIds.map(id => parseInt(id)),
    ]));

    return prisma.chatRoom.create({
      data: {
        type: 'GROUP',
        name: name || null,
        creatorId,
        members: memberIds.length > 0 ? {
          create: memberIds.map(userId => ({
            userId,
            role: userId === creatorId ? 'ADMIN' : 'MEMBER',
          })),
        } : undefined,
      },
      include: {
        members: {
          include: { user: { select: { id: true, fullname: true, email: true } } }
        }
      }
    });
  },

  // Find an existing 1:1 room between two users, or create one.
  // IMPORTANT: `userId` must come from the authenticated request
  // (e.g. req.user.id from JWT middleware), never from the request body.
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

    // Deterministic key regardless of who calls it first.
    const [a, b] = [userId, otherUserId].sort((x, y) => x - y);
    const directKey = `${a}_${b}`;

    // upsert is atomic at the DB level, so two simultaneous calls for the
    // same pair safely collapse to one room instead of racing past a
    // findFirst check.
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

  // NOTE — this is an admin/global "every room" listing, not the
  // per-user inbox. Offset pagination is fine here: the spec's keyset-
  // pagination concern (§7.3/§10.2) is specifically about the per-user
  // inbox scaling with message volume, which is what getForUser below
  // now handles. Don't use this for a chat screen's conversation list.
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
          // CHANGED — lastMessage is now the ChatLastMessage cache row,
          // not a direct ChatMessage relation. ChatLastMessage has no
          // `user` field of its own (only a scalar senderId); sender
          // details, if needed, come through the nested `message.user`
          // relation.
          lastMessage: {
            include: { message: { include: { user: { select: { id: true, fullname: true } } } } },
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

  // Rooms for a specific user (the inbox), with unread count attached.
  //
  // CHANGED — was offset pagination (`skip`/`take` on ChatRoomMember,
  // ordered by room.updatedAt). Now keyset pagination on
  // ChatLastMessage.updatedAt (spec §7.3/§10.2), matching the exact
  // pattern the spec's `GET /conversations` uses: paginate the
  // lightweight cache table FIRST, then join room/member/profile data
  // only for that page's rooms — not the user's entire room list on
  // every request. Signature changed from `{ page, limit }` to
  // `{ before, limit }`: `before` is the `updatedAt` cursor from the
  // previous page's last row (returned as `nextCursor` below).
  async getForUser({ userId, before, limit = 30 }) {
    userId = parseInt(userId);
    const take = parseInt(limit);

    // Cheap — a user isn't in thousands of rooms, so this doesn't need
    // its own pagination. Gives us the room ids to scope the cache-table
    // query to, plus this user's lastReadSeq per room for unread counts.
    const memberships = await prisma.chatRoomMember.findMany({
      where: { userId },
      select: { roomId: true, lastReadSeq: true },
    });
    if (memberships.length === 0) return { data: [], nextCursor: null };

    const lastReadByRoom = new Map(memberships.map(m => [m.roomId, m.lastReadSeq]));
    const roomIds = memberships.map(m => m.roomId);

    const lastMessages = await prisma.chatLastMessage.findMany({
      where: {
        roomId: { in: roomIds },
        ...(before && { updatedAt: { lt: new Date(before) } }),
      },
      orderBy: { updatedAt: 'desc' },
      take,
    });

    // Rooms with no ChatLastMessage row yet (a group just created, no
    // one has sent a message) have no cursor value to paginate on and
    // would otherwise never surface. Only checked on the first page
    // (`before` unset) — an empty room stays pinned at the top until its
    // first message gives it a real cursor value, then it's picked up by
    // the ChatLastMessage query above like any other room.
    let emptyRooms = [];
    if (!before) {
      const activeRoomIds = new Set(lastMessages.map(lm => lm.roomId));
      const candidateIds = roomIds.filter(id => !activeRoomIds.has(id));
      if (candidateIds.length > 0) {
        emptyRooms = await prisma.chatRoom.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    if (lastMessages.length === 0 && emptyRooms.length === 0) {
      return { data: [], nextCursor: null };
    }

    const pageRoomIds = [...lastMessages.map(lm => lm.roomId), ...emptyRooms.map(r => r.id)];
    const rooms = await prisma.chatRoom.findMany({
      where: { id: { in: pageRoomIds } },
      include: {
        members: {
          include: { user: { select: { id: true, fullname: true, email: true, isOnline: true, lastSeenAt: true } } }
        },
      },
    });
    const roomById = new Map(rooms.map(r => [r.id, r]));

    const senderIds = [...new Set(lastMessages.map(lm => lm.senderId).filter(Boolean))];
    const senders = senderIds.length
      ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, fullname: true } })
      : [];
    const senderById = new Map(senders.map(s => [s.id, s]));

    const activeRows = lastMessages.map(lm => {
      const room = roomById.get(lm.roomId);
      return {
        roomId: lm.roomId,
        name: room.name,
        participants: room.members.filter(mem => mem.userId !== userId).map(mem => mem.user),
        lastMessage: {
          preview: lm.preview,
          senderId: lm.senderId,
          sender: lm.senderId ? senderById.get(lm.senderId) : null,
          seq: lm.seq,
          updatedAt: lm.updatedAt,
        },
        // CHANGED — unreadCount no longer exists as a stored field on
        // ChatRoomMember. Computed from room.seqCounter minus this
        // member's lastReadSeq (spec §7.2) — a stored counter can drift
        // out of sync under retries/races with no way to detect it.
        unreadCount: Math.max(0, room.seqCounter - (lastReadByRoom.get(lm.roomId) ?? 0)),
        updatedAt: lm.updatedAt,
      };
    });

    const emptyRows = emptyRooms.map(r => {
      const room = roomById.get(r.id);
      return {
        roomId: r.id,
        name: r.name,
        participants: room.members.filter(mem => mem.userId !== userId).map(mem => mem.user),
        lastMessage: null,
        unreadCount: 0,
        updatedAt: r.createdAt,
      };
    });

    return {
      // Empty (message-less) rooms pinned at the top, then the
      // cursor-paginated active conversations.
      data: [...emptyRows, ...activeRows],
      // Cursor only advances based on the active page — once you've
      // exhausted ChatLastMessage rows there's nothing further to page
      // through (empty rooms only ever appear on page 1).
      nextCursor: activeRows.length === take ? activeRows[activeRows.length - 1].updatedAt : null,
    };
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
        // NOTE: this pulls the ENTIRE unpaginated message history for
        // the room. Fine for a lightweight "room details" call, but the
        // actual chat screen should use ChatMessageService's
        // getMessagesByCursor (keyset pagination on `seq`) instead.
        messages: {
          where: { deletedAt: null },
          orderBy: { seq: 'asc' }, // CHANGED from sentAt — seq is the strict per-room order
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

    // CHANGED — there's no more `lastMessageId` field to null out. The
    // inbox cache is now its own ChatLastMessage row, and its FKs to
    // ChatMessage/ChatRoom are Restrict (not SetNull), so that row must
    // be deleted before the underlying messages/room can go.
    // MessageRead, MessageDeliveryReceipt, and MessageDeletionForUser
    // all cascade automatically on message delete now (onDelete: Cascade
    // in the schema), so they no longer need manual cleanup here.
    await prisma.$transaction([
      prisma.chatLastMessage.deleteMany({ where: { roomId: id } }),
      prisma.chatMessage.deleteMany({ where: { roomId: id } }),
      prisma.chatRoomMember.deleteMany({ where: { roomId: id } }),
      prisma.chatRoom.delete({ where: { id } }),
    ]);
  },

  // CHANGED — added a group-only guard. This directly closes the bug
  // described in spec §14.28: without checking room.type, this endpoint
  // could be called against a DIRECT room's id.
  // CHANGED — now takes `requesterUserId`. Previously this only checked
  // the TARGET room was a group; it never checked who was asking, so any
  // existing member (not just admins) could add someone else — violating
  // spec §4.5, which explicitly scopes "add members" to admin-only. Same
  // shape as removeMember below.
  async addMember(roomId, requesterUserId, { userId, role = 'MEMBER' }) {
    roomId = parseInt(roomId);
    requesterUserId = parseInt(requesterUserId);
    userId = parseInt(userId);

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }
    if (room.type !== 'GROUP') {
      const error = new Error('Cannot add members to a direct conversation');
      error.statusCode = 400;
      throw error;
    }

    const requester = await prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requesterUserId } },
    });
    if (!requester || requester.role !== 'ADMIN') {
      const error = new Error('Only admins can add members');
      error.statusCode = 403;
      throw error;
    }

    try {
      return await prisma.chatRoomMember.create({
        data: { roomId, userId, role },
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

  // CHANGED — signature now takes `requesterUserId` as well as the
  // target, because who's allowed to remove whom depends on roles
  // (spec §4.5): admins can remove anyone; a member can only remove
  // themself ("leave group"); the sole remaining admin can't self-remove
  // without promoting someone else first.
  //
  // This is also the fix for spec §14.28's actual bug: the old
  // removeMember had no group check at all, so a user could call it
  // against their own DIRECT room's id and delete just their own
  // membership row, leaving the room (and its directKey) orphaned —
  // permanently locking them out of ever messaging that person again,
  // since a future findOrCreateDirect resolves to the same directKey but
  // finds no membership row for them.
  async removeMember(roomId, requesterUserId, targetUserId) {
    roomId = parseInt(roomId);
    requesterUserId = parseInt(requesterUserId);
    targetUserId = parseInt(targetUserId);

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }
    if (room.type !== 'GROUP') {
      const error = new Error('Cannot remove members from a direct conversation');
      error.statusCode = 400;
      throw error;
    }

    const requester = await prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requesterUserId } },
    });
    if (!requester) {
      const error = new Error('You are not a member of this room');
      error.statusCode = 403;
      throw error;
    }

    const isSelfRemoval = requesterUserId === targetUserId;
    if (!isSelfRemoval && requester.role !== 'ADMIN') {
      const error = new Error('Only admins can remove other members');
      error.statusCode = 403;
      throw error;
    }

    if (isSelfRemoval && requester.role === 'ADMIN') {
      const adminCount = await prisma.chatRoomMember.count({ where: { roomId, role: 'ADMIN' } });
      if (adminCount <= 1) {
        const error = new Error('Promote another member to admin before leaving');
        error.statusCode = 400;
        throw error;
      }
    }

    return prisma.chatRoomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } }
    });
  },

  // NEW — promote/demote a member (spec §4.5's PATCH .../role endpoint).
  // Admin-only. Didn't exist before because there was no `role` field to
  // change.
  async updateMemberRole(roomId, requesterUserId, targetUserId, role) {
    roomId = parseInt(roomId);
    requesterUserId = parseInt(requesterUserId);
    targetUserId = parseInt(targetUserId);

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }
    if (room.type !== 'GROUP') {
      const error = new Error('Direct conversations have no roles');
      error.statusCode = 400;
      throw error;
    }

    const requester = await prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requesterUserId } },
    });
    if (!requester || requester.role !== 'ADMIN') {
      const error = new Error('Only admins can change member roles');
      error.statusCode = 403;
      throw error;
    }

    return prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role },
      include: { user: { select: { id: true, fullname: true, email: true } } },
    });
  },
  // NEW — mutedUntil existed on ChatRoomMember but nothing set it. The
  // spec's push-notification worker (§12) reads this field to decide
  // whether to skip a push; without a way to write it, muting a
  // conversation was a schema field with no code path to it.
  async muteRoom(roomId, userId, mutedUntil) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);

    const membership = await prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      const error = new Error('You are not a member of this room');
      error.statusCode = 403;
      throw error;
    }

    return prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { mutedUntil: mutedUntil ? new Date(mutedUntil) : null },
    });
  },

  async unmuteRoom(roomId, userId) {
    // Calls chatRoomService.muteRoom directly rather than `this.muteRoom`
    // — this object literal has no class/prototype binding, so `this`
    // only resolves correctly if unmuteRoom is always invoked as
    // `chatRoomService.unmuteRoom(...)`. Referencing the module-level
    // const instead works regardless of how this method is called or
    // passed around (destructured, passed as a bare reference, etc.),
    // since by the time any method actually runs, module evaluation has
    // already finished and `chatRoomService` is fully bound.
    return chatRoomService.muteRoom(roomId, userId, null);
  },

  async leaveConversation(roomId, userId) {
    await requireParticipant(roomId, userId);

    await prisma.chatRoomMember.delete({
        where: {
            roomId_userId: {
                roomId,
                userId
            }
        }
    });
}

};

export default chatRoomService;

