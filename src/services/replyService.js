import prisma from "../lib/prisma";

const replyService = {

    
    /**
     * Fetch paginated replies for a specific comment.
     * Called on-demand when user taps "View replies".
     */
    async getCommentReplies  (commentId, { page = 1, limit = 10 } = {}){
      const skip = (page - 1) * limit;
    
      const [replies, total] = await Promise.all([
        prisma.reply.findMany({
          where: { commentId: Number(commentId) },
          orderBy: { createdAt: "asc" }, // oldest first for replies (threaded feel)
          skip,
          take: limit,
          select: {
            id: true,
            text: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                fullname: true,
                profile: { select: { avatarUrl: true } },
              },
            },
          },
        }),
        prisma.reply.count({ where: { commentId: Number(commentId) } }),
      ]);
    
      return {
        replies,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    
    /**
     * Post a reply to a comment.
     */
    async addReply (commentId, userId, text) {
      // Ensure parent comment exists
      const comment = await prisma.comment.findUnique({
        where: { id: Number(commentId) },
        select: { id: true },
      });
      if (!comment) throw { status: 404, message: "Comment not found" };
    
      return prisma.reply.create({
        data: {
          text,
          commentId: Number(commentId),
          userId: Number(userId),
        },
        select: {
          id: true,
          text: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullname: true,
              profile: { select: { avatarUrl: true } },
            },
          },
        },
      });
    },
    
    /**
     * Delete a reply (only by owner).
     */
    async deleteReply  (replyId, userId) {
      const reply = await prisma.reply.findUnique({
        where: { id: Number(replyId) },
        select: { userId: true },
      });
    
      if (!reply) throw { status: 404, message: "Reply not found" };
      if (reply.userId !== Number(userId))
        throw { status: 403, message: "Not authorized to delete this reply" };
    
      await prisma.reply.delete({ where: { id: Number(replyId) } });
      return { message: "Reply deleted" };
    },
}

export default replyService;
