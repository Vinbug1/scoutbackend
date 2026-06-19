// src/services/commentService.js
import prisma from '../lib/prisma.js';

// ─── Shared select shape for a comment returned to the client ─────────────────
const COMMENT_SELECT = {
  id:        true,
  text:      true,
  createdAt: true,
  user: {
    select: {
      id:           true,
      fullname:     true,
      scoutProfile: { select: { avatarUrl: true } }, // ✅ fixed: was profile
    },
  },
  _count: {
    select: {
      replies: true,
      likes:   true,
    },
  },
};

// =========================================================
// 🔹 Attach viewer interactions to each comment
//    - hasLiked:   viewer liked this comment
//    - hasReplied: viewer posted at least one reply on this comment
// =========================================================
const attachViewerCommentInteractions = async (comments, viewerId) => {
  // ── flatten scoutProfile.avatarUrl onto user for every comment ─────────────
  const flatten = (c) => ({
    ...c,
    user: {
      id:        c.user.id,
      fullname:  c.user.fullname,
      avatarUrl: c.user.scoutProfile?.avatarUrl ?? null, // ✅ fixed: was profile
    },
  });

  if (!viewerId || comments.length === 0) {
    return comments.map((c) => ({
      ...flatten(c),
      viewerActions: {
        hasLiked:   false,
        hasReplied: false,
      },
    }));
  }

  const commentIds = comments.map((c) => c.id);

  const [likes, replies] = await Promise.all([
    prisma.commentLike.findMany({
      where:  { userId: viewerId, commentId: { in: commentIds } },
      select: { commentId: true },
    }),
    prisma.reply.findMany({
      where:  { userId: viewerId, commentId: { in: commentIds } },
      select: { commentId: true },
    }),
  ]);

  const liked   = new Set(likes.map((x) => x.commentId));
  const replied = new Set(replies.map((x) => x.commentId));

  return comments.map((c) => ({
    ...flatten(c),
    viewerActions: {
      hasLiked:   liked.has(c.id),
      hasReplied: replied.has(c.id),
    },
  }));
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
   * Pass viewerId to get per-comment viewer interaction flags.
   *
   * Each comment will include:
   *   viewerActions: { hasLiked, hasReplied }
   */
  async getReelComments(reelId, { page = 1, limit = 20, viewerId = null } = {}) {
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

    const enriched = await attachViewerCommentInteractions(comments, viewerId);

    return {
      comments: enriched,
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


