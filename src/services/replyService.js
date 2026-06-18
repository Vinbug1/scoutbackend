// src/services/replyService.js
import prisma from '../lib/prisma.js';

// ─── Shared select shape for a reply returned to the client ───────────────────
const REPLY_SELECT = {
  id:        true,
  text:      true,
  createdAt: true,
  user: {
    select: {
      id:       true,
      fullname: true,
      profile:  { select: { avatarUrl: true } },
    },
  },
  _count: {
    select: {
      likes: true, // ✅ add this
    },
  },
};

const replyService = {

  /**
   * Fetch paginated replies for a specific comment.
   * Triggered when user taps "View X replies" under a comment.
   * Ordered oldest-first so the thread reads naturally top-to-bottom.
   */
  async getCommentReplies(commentId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    // Verify the parent comment exists
    const comment = await prisma.comment.findUnique({
      where:  { id: Number(commentId) },
      select: { id: true },
    });
    if (!comment) throw { status: 404, message: 'Comment not found' };

    const [replies, total] = await Promise.all([
      prisma.reply.findMany({
        where:   { commentId: Number(commentId) },
        orderBy: { createdAt: 'asc' },
        skip,
        take:    limit,
        select:  REPLY_SELECT,
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
   * Optionally prepends a mention (e.g. "@Vincent Williams") to the text.
   */
  async addReply(commentId, userId, text, mentionedUser = null) {
    // Verify the parent comment exists
    const comment = await prisma.comment.findUnique({
      where:  { id: Number(commentId) },
      select: { id: true },
    });
    if (!comment) throw { status: 404, message: 'Comment not found' };

    // Prepend mention if provided and not already in the text
    const finalText =
      mentionedUser && !text.startsWith(mentionedUser)
        ? `${mentionedUser} ${text}`
        : text;

    return prisma.reply.create({
      data: {
        text:      finalText,
        commentId: Number(commentId),
        userId:    Number(userId),
      },
      select: REPLY_SELECT,
    });
  },

  /**
   * Delete a reply (only by owner).
   */
  async deleteReply(replyId, userId) {
    const reply = await prisma.reply.findUnique({
      where:  { id: Number(replyId) },
      select: { userId: true },
    });

    if (!reply) throw { status: 404, message: 'Reply not found' };
    if (reply.userId !== Number(userId)) {
      throw { status: 403, message: 'Not authorized to delete this reply' };
    }

    await prisma.reply.delete({ where: { id: Number(replyId) } });
    return { message: 'Reply deleted successfully' };
  },
};

export default replyService;











// import prisma from "../lib/prisma";

// const replyService = {

    
//     /**
//      * Fetch paginated replies for a specific comment.
//      * Called on-demand when user taps "View replies".
//      */
//     async getCommentReplies  (commentId, { page = 1, limit = 10 } = {}){
//       const skip = (page - 1) * limit;
    
//       const [replies, total] = await Promise.all([
//         prisma.reply.findMany({
//           where: { commentId: Number(commentId) },
//           orderBy: { createdAt: "asc" }, // oldest first for replies (threaded feel)
//           skip,
//           take: limit,
//           select: {
//             id: true,
//             text: true,
//             createdAt: true,
//             user: {
//               select: {
//                 id: true,
//                 fullname: true,
//                 profile: { select: { avatarUrl: true } },
//               },
//             },
//           },
//         }),
//         prisma.reply.count({ where: { commentId: Number(commentId) } }),
//       ]);
    
//       return {
//         replies,
//         pagination: {
//           total,
//           page,
//           limit,
//           totalPages: Math.ceil(total / limit),
//         },
//       };
//     },
    
//     /**
//      * Post a reply to a comment.
//      */
//     async addReply (commentId, userId, text) {
//       // Ensure parent comment exists
//       const comment = await prisma.comment.findUnique({
//         where: { id: Number(commentId) },
//         select: { id: true },
//       });
//       if (!comment) throw { status: 404, message: "Comment not found" };
    
//       return prisma.reply.create({
//         data: {
//           text,
//           commentId: Number(commentId),
//           userId: Number(userId),
//         },
//         select: {
//           id: true,
//           text: true,
//           createdAt: true,
//           user: {
//             select: {
//               id: true,
//               fullname: true,
//               profile: { select: { avatarUrl: true } },
//             },
//           },
//         },
//       });
//     },
    
//     /**
//      * Delete a reply (only by owner).
//      */
//     async deleteReply  (replyId, userId) {
//       const reply = await prisma.reply.findUnique({
//         where: { id: Number(replyId) },
//         select: { userId: true },
//       });
    
//       if (!reply) throw { status: 404, message: "Reply not found" };
//       if (reply.userId !== Number(userId))
//         throw { status: 403, message: "Not authorized to delete this reply" };
    
//       await prisma.reply.delete({ where: { id: Number(replyId) } });
//       return { message: "Reply deleted" };
//     },
// }

// export default replyService;
