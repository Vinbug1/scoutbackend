// src/services/commentLikeService.js
import prisma from '../lib/prisma.js';

const commentLikeService = {

  // ─── Comment Likes ───────────────────────────────────────────────────────────

  /**
   * Toggle like on a comment.
   * Triggered: user taps the heart/like on a comment.
   */
  async toggleCommentLike(commentId, userId) {
    const id  = Number(commentId);
    const uid = Number(userId);

    const comment = await prisma.comment.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!comment) throw { status: 404, message: 'Comment not found' };

    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId: id, userId: uid } },
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.commentLike.create({ data: { commentId: id, userId: uid } });
    }

    const likesCount = await prisma.commentLike.count({ where: { commentId: id } });
    return { liked: !existing, likesCount };
  },

  /**
   * Get like count + current user's like status for a comment.
   */
  async getCommentLikes(commentId, userId) {
    const id = Number(commentId);

    const comment = await prisma.comment.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!comment) throw { status: 404, message: 'Comment not found' };

    const [likesCount, userLike] = await Promise.all([
      prisma.commentLike.count({ where: { commentId: id } }),
      userId
        ? prisma.commentLike.findUnique({
            where: { commentId_userId: { commentId: id, userId: Number(userId) } },
          })
        : null,
    ]);

    return { commentId: id, likesCount, likedByMe: !!userLike };
  },

  /**
   * Get like count only for a comment — no auth required.
   */
  async getCommentLikesCount(commentId) {
    const id = Number(commentId);

    const comment = await prisma.comment.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!comment) throw { status: 404, message: 'Comment not found' };

    const likesCount = await prisma.commentLike.count({ where: { commentId: id } });
    return { commentId: id, likesCount };
  },

  // ─── Reply Likes ─────────────────────────────────────────────────────────────

  /**
   * Toggle like on a reply.
   * Triggered: user taps the heart/like on a reply.
   */
  async toggleReplyLike(replyId, userId) {
    const id  = Number(replyId);
    const uid = Number(userId);

    const reply = await prisma.reply.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!reply) throw { status: 404, message: 'Reply not found' };

    const existing = await prisma.replyLike.findUnique({
      where: { replyId_userId: { replyId: id, userId: uid } },
    });

    if (existing) {
      await prisma.replyLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.replyLike.create({ data: { replyId: id, userId: uid } });
    }

    const likesCount = await prisma.replyLike.count({ where: { replyId: id } });
    return { liked: !existing, likesCount };
  },

  /**
   * Get like count + current user's like status for a reply.
   */
  async getReplyLikes(replyId, userId) {
    const id = Number(replyId);

    const reply = await prisma.reply.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!reply) throw { status: 404, message: 'Reply not found' };

    const [likesCount, userLike] = await Promise.all([
      prisma.replyLike.count({ where: { replyId: id } }),
      userId
        ? prisma.replyLike.findUnique({
            where: { replyId_userId: { replyId: id, userId: Number(userId) } },
          })
        : null,
    ]);

    return { replyId: id, likesCount, likedByMe: !!userLike };
  },

  // ─── Reel Likes ──────────────────────────────────────────────────────────────

  /**
   * Toggle like on a reel.
   * Triggered: user taps the heart/like on a reel.
   */
  async toggleReelLike(reelId, userId) {
    const id  = Number(reelId);
    const uid = Number(userId);

    const reel = await prisma.reel.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!reel) throw { status: 404, message: 'Reel not found' };

    const existing = await prisma.reelLike.findUnique({
      where: { reelId_userId: { reelId: id, userId: uid } },
    });

    if (existing) {
      await prisma.reelLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.reelLike.create({ data: { reelId: id, userId: uid } });
    }

    const likesCount = await prisma.reelLike.count({ where: { reelId: id } });
    return { liked: !existing, likesCount };
  },

  /**
   * Get like count + current user's like status for a reel.
   */
  async getReelLikes(reelId, userId) {
    const id = Number(reelId);

    const reel = await prisma.reel.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!reel) throw { status: 404, message: 'Reel not found' };

    const [likesCount, userLike] = await Promise.all([
      prisma.reelLike.count({ where: { reelId: id } }),
      userId
        ? prisma.reelLike.findUnique({
            where: { reelId_userId: { reelId: id, userId: Number(userId) } },
          })
        : null,
    ]);

    return { reelId: id, likesCount, likedByMe: !!userLike };
  },

  /**
   * Get like count only for a reel — no auth required.
   */
  async getReelLikesCount(reelId) {
    const id = Number(reelId);

    const reel = await prisma.reel.findUnique({
      where:  { id },
      select: { id: true },
    });
    if (!reel) throw { status: 404, message: 'Reel not found' };

    const likesCount = await prisma.reelLike.count({ where: { reelId: id } });
    return { reelId: id, likesCount };
  },
};

export default commentLikeService;


