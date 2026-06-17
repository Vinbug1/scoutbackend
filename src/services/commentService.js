// src/services/commentService.js
import prisma from '../lib/prisma.js';

// ─── Shared select shape for a comment returned to the client ─────────────────
const COMMENT_SELECT = {
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
    select: { replies: true }, // shows "View X replies" count — no reply data fetched
  },
};

const commentService = {

  // ─── General CRUD (posts / videos / reels) ──────────────────────────────────

  async createComment({ text, userId, postId, videoId, reelId }) {
    return prisma.comment.create({
      data: {
        text,
        userId:  Number(userId),
        postId:  postId  ? Number(postId)  : null,
        videoId: videoId ? Number(videoId) : null,
        reelId:  reelId  ? Number(reelId)  : null,
      },
      include: {
        user:  { select: { id: true, fullname: true } },
        post:  true,
        video: true,
        reel:  true,
      },
    });
  },

  async getComments({ postId, videoId, reelId }) {
    return prisma.comment.findMany({
      where: {
        postId:  postId  ? Number(postId)  : undefined,
        videoId: videoId ? Number(videoId) : undefined,
        reelId:  reelId  ? Number(reelId)  : undefined,
      },
      include: {
        user:  { select: { id: true, fullname: true } },
        post:  true,
        video: true,
        reel:  true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getCommentById(id) {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        user:  { select: { id: true, fullname: true } },
        post:  true,
        video: true,
        reel:  true,
      },
    });

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    return comment;
  },

  async updateComment(id, { text }) {
    return prisma.comment.update({
      where: { id },
      data:  { text },
    });
  },

  async deleteComment(id) {
    return prisma.comment.delete({ where: { id } });
  },

  // ─── Reel-specific comment methods (lazy-loaded) ─────────────────────────────

  /**
   * Fetch paginated TOP-LEVEL comments for a reel.
   * Triggered when user taps the comment icon on a reel.
   * Replies are NOT fetched — only their count is returned per comment.
   */
  async getReelComments(reelId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where:   { reelId: Number(reelId) },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
        select:  COMMENT_SELECT,
      }),
      prisma.comment.count({ where: { reelId: Number(reelId) } }),
    ]);

    return {
      comments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Post a new top-level comment on a reel.
   */
  async addReelComment(reelId, userId, text) {
    // Verify the reel exists first
    const reel = await prisma.reel.findUnique({
      where:  { id: Number(reelId) },
      select: { id: true },
    });
    if (!reel) throw { status: 404, message: 'Reel not found' };

    return prisma.comment.create({
      data: {
        text,
        reelId: Number(reelId),
        userId: Number(userId),
      },
      select: COMMENT_SELECT,
    });
  },

  /**
   * Delete a comment (only by owner). Cascades to all replies via DB.
   */
  async deleteReelComment(commentId, userId) {
    const comment = await prisma.comment.findUnique({
      where:  { id: Number(commentId) },
      select: { userId: true, reelId: true },
    });

    if (!comment) throw { status: 404, message: 'Comment not found' };
    if (comment.userId !== Number(userId)) {
      throw { status: 403, message: 'Not authorized to delete this comment' };
    }

    await prisma.comment.delete({ where: { id: Number(commentId) } });
    return { message: 'Comment deleted successfully' };
  },
};

export default commentService;







// import prisma from '../lib/prisma.js';

// const commentService = {

//   async createComment({ text, userId, postId, videoId, reelId }) {
//     return prisma.comment.create({
//       data: {
//         text,
//         userId:  Number(userId),
//         postId:  postId  ? Number(postId)  : null,
//         videoId: videoId ? Number(videoId) : null,
//         reelId:  reelId  ? Number(reelId)  : null,
//       },
//       include: {
//         user:  { select: { id: true, fullname: true } },
//         post:  true,
//         video: true,
//         reel:  true,
//       },
//     });
//   },

//   // Filter by postId, videoId, or reelId
//   async getComments({ postId, videoId, reelId }) {
//     return prisma.comment.findMany({
//       where: {
//         postId:  postId  ? Number(postId)  : undefined,
//         videoId: videoId ? Number(videoId) : undefined,
//         reelId:  reelId  ? Number(reelId)  : undefined,
//       },
//       include: {
//         user:  { select: { id: true, fullname: true } },
//         post:  true,
//         video: true,
//         reel:  true,
//       },
//       orderBy: { createdAt: 'desc' },
//     });
//   },

//   async getCommentById(id) {
//     const comment = await prisma.comment.findUnique({
//       where: { id },
//       include: {
//         user:  { select: { id: true, fullname: true } },
//         post:  true,
//         video: true,
//         reel:  true,
//       },
//     });

//     if (!comment) {
//       const error = new Error('Comment not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     return comment;
//   },

//   async updateComment(id, { text }) {
//     return prisma.comment.update({
//       where: { id },
//       data:  { text },
//     });
//   },

//   async deleteComment(id) {
//     return prisma.comment.delete({ where: { id } });
//   },

//   /**
//  * Fetch paginated top-level comments for a reel.
//  * Replies are NOT included — they are fetched separately on demand.
//  */
//   async getReelComments (reelId, { page = 1, limit = 20 } = {}) {
//     const skip = (page - 1) * limit;

//     const [comments, total] = await Promise.all([
//       prisma.comment.findMany({
//         where: { reelId: Number(reelId) },
//         orderBy: { createdAt: "desc" },
//         skip,
//         take: limit,
//         select: {
//           id: true,
//           text: true,
//           createdAt: true,
//           user: {
//             select: {
//               id: true,
//               fullname: true,
//               profile: {
//                 select: { avatarUrl: true },
//               },
//             },
//           },
//           _count: {
//             select: { replies: true }, // reply count shown on comment — no data fetched
//           },
//         },
//       }),
//       prisma.comment.count({ where: { reelId: Number(reelId) } }),
//     ]);

//     return {
//       comments,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     };
//   },

//   /**
//    * Post a new top-level comment on a reel.
//    */
//   async addReelComment (reelId, userId, text) {
//     return prisma.comment.create({
//       data: {
//         text,
//         reelId: Number(reelId),
//         userId: Number(userId),
//       },
//       select: {
//         id: true,
//         text: true,
//         createdAt: true,
//         user: {
//           select: {
//             id: true,
//             fullname: true,
//             profile: { select: { avatarUrl: true } },
//           },
//         },
//       },
//     });
//   },
//   /**
//    * Delete a comment (only by owner).
//    */
//   async deleteReelComment (commentId, userId){
//     const comment = await prisma.comment.findUnique({
//       where: { id: Number(commentId) },
//       select: { userId: true, reelId: true },
//     });

//     if (!comment) throw { status: 404, message: "Comment not found" };
//     if (comment.userId !== Number(userId))
//       throw { status: 403, message: "Not authorized to delete this comment" };

//     await prisma.comment.delete({ where: { id: Number(commentId) } });
//     return { message: "Comment deleted" };
//   }

// };

// export default commentService;


