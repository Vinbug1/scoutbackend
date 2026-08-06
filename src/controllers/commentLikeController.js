// src/controllers/commentLikeController.js
import commentLikeService from '../services/commentLikeService.js';

const commentLikeController = {

  // ─── Comment Likes ───────────────────────────────────────────────────────────

  async toggleCommentLike(req, res) {
    try {
      const { commentId } = req.params;
      const userId        = req.user?.userId; // ✅ fixed

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

      const data = await commentLikeService.toggleCommentLike(commentId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] toggleCommentLike error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async getCommentLikes(req, res) {
    try {
      const { commentId } = req.params;
      const userId        = req.user?.userId ?? null; // ✅ fixed

      const data = await commentLikeService.getCommentLikes(commentId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] getCommentLikes error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async getCommentLikesCount(req, res) {
    try {
      const { commentId } = req.params;

      const data = await commentLikeService.getCommentLikesCount(commentId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] getCommentLikesCount error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  // ─── Reply Likes ─────────────────────────────────────────────────────────────

  async toggleReplyLike(req, res) {
    try {
      const { replyId } = req.params;
      const userId      = req.user?.userId; // ✅ fixed

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

      const data = await commentLikeService.toggleReplyLike(replyId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] toggleReplyLike error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async getReplyLikes(req, res) {
    try {
      const { replyId } = req.params;
      const userId      = req.user?.userId ?? null; // ✅ fixed

      const data = await commentLikeService.getReplyLikes(replyId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] getReplyLikes error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  // ─── Reel Likes ──────────────────────────────────────────────────────────────

  async toggleReelLike(req, res) {
    try {
      const { reelId } = req.params;
      const userId     = req.user?.userId; // ✅ fixed

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

      const data = await commentLikeService.toggleReelLike(reelId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] toggleReelLike error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async getReelLikes(req, res) {
    try {
      const { reelId } = req.params;
      const userId     = req.user?.userId ?? null; // ✅ fixed

      const data = await commentLikeService.getReelLikes(reelId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] getReelLikes error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async getReelLikesCount(req, res) {
    try {
      const { reelId } = req.params;

      const data = await commentLikeService.getReelLikesCount(reelId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[CommentLike] getReelLikesCount error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

};

export default commentLikeController;

