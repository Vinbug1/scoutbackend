import prisma from '../lib/prisma.js';

// =========================================================
// Reply select shape
// =========================================================
const REPLY_SELECT = {
  id:        true,
  text:      true,
  createdAt: true,
  user: {
    select: {
      id:       true,
      fullname: true,
      scoutProfile: {          // ✅ matches commentService pattern
        select: { avatarUrl: true },
      },
    },
  },
  _count: {
    select: { likes: true },
  },
};
 
// =========================================================
// 🔹 Flatten scoutProfile.avatarUrl onto user
// =========================================================
const flattenReply = (reply) => ({
  ...reply,
  user: {
    id:        reply.user.id,
    fullname:  reply.user.fullname,
    avatarUrl: reply.user.scoutProfile?.avatarUrl ?? null, // ✅ lifted up
  },
});
 
// =========================================================
// 🔹 Attach viewer interactions to each reply
//    - hasLiked: viewer liked this reply
// =========================================================
const attachViewerReplyInteractions = async (replies, viewerId) => {
  if (!viewerId || replies.length === 0) {
    return replies.map((reply) => ({
      ...flattenReply(reply),
      viewerActions: { hasLiked: false },
    }));
  }
 
  const replyIds = replies.map((r) => r.id);
 
  const likes = await prisma.replyLike.findMany({
    where: {
      userId:  Number(viewerId),
      replyId: { in: replyIds },
    },
    select: { replyId: true },
  });
 
  const liked = new Set(likes.map((r) => r.replyId));
 
  return replies.map((reply) => ({
    ...flattenReply(reply),
    viewerActions: { hasLiked: liked.has(reply.id) },
  }));
};

const replyService = {

  // =========================================================
  // GET replies
  // =========================================================
  async getCommentReplies(
    commentId,
    {
      page = 1,
      limit = 10,
      viewerId = null,
    } = {}
  ) {

    const safePage =
      Math.max(
        1,
        Number(page)
      );

    const safeLimit =
      Math.min(
        100,
        Math.max(
          1,
          Number(limit)
        )
      );

    const skip =
      (safePage - 1) *
      safeLimit;

    const comment =
      await prisma.comment.findUnique({
        where: {
          id:
            Number(
              commentId
            ),
        },

        select: {
          id: true,
        },
      });

    if (!comment) {
      throw {
        status: 404,
        message:
          'Comment not found',
      };
    }

    const [
      replies,
      total,
    ] =
      await Promise.all([
        prisma.reply.findMany({
          where: {
            commentId:
              Number(
                commentId
              ),
          },

          orderBy: {
            createdAt:
              'asc',
          },

          skip,

          take:
            safeLimit,

          select:
            REPLY_SELECT,
        }),

        prisma.reply.count({
          where: {
            commentId:
              Number(
                commentId
              ),
          },
        }),
      ]);

    const enriched =
      await attachViewerReplyInteractions(
        replies,
        viewerId
      );

    return {
      replies:
        enriched,

      pagination: {
        total,

        page:
          safePage,

        limit:
          safeLimit,

        totalPages:
          Math.ceil(
            total /
              safeLimit
          ),
      },
    };

  },

  // =========================================================
  // CREATE reply
  // =========================================================
  async addReply(
    commentId,
    userId,
    text,
    mentionedUser = null
  ) {

    const comment =
      await prisma.comment.findUnique({
        where: {
          id:
            Number(
              commentId
            ),
        },

        select: {
          id: true,
        },
      });

    if (!comment) {
      throw {
        status: 404,
        message:
          'Comment not found',
      };
    }

    const finalText =
      mentionedUser &&
      !text.startsWith(
        mentionedUser
      )
        ? `${mentionedUser} ${text}`
        : text;

    const reply =
      await prisma.reply.create({
        data: {
          text:
            finalText,

          commentId:
            Number(
              commentId
            ),

          userId:
            Number(
              userId
            ),
        },

        select:
          REPLY_SELECT,
      });

    const [enriched] =
      await attachViewerReplyInteractions(
        [reply],
        userId
      );

    return enriched;

  },

  // =========================================================
  // DELETE reply
  // =========================================================
  async deleteReply(
    replyId,
    userId
  ) {

    const reply =
      await prisma.reply.findUnique({
        where: {
          id:
            Number(
              replyId
            ),
        },

        select: {
          userId:
            true,
        },
      });

    if (!reply) {
      throw {
        status: 404,
        message:
          'Reply not found',
      };
    }

    if (
      reply.userId !==
      Number(
        userId
      )
    ) {
      throw {
        status: 403,
        message:
          'Not authorized',
      };
    }

    await prisma.reply.delete({
      where: {
        id:
          Number(
            replyId
          ),
      },
    });

    return {
      message:
        'Reply deleted successfully',
    };

  },

};

export default replyService;

