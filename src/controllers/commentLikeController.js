import commentLikeService from '../services/commentLikeService.js';

const commentLikeController = {

  // POST /api/reels/comments/:commentId/likes
  // Triggered: user taps the like button on a comment
  async toggleCommentLike(req, res) {
    try {
      const { commentId } = req.params;
      const userId        = req.user.id;

      const result = await commentLikeService.toggleCommentLike(commentId, userId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error('[CommentLike] toggleCommentLike error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },

  // GET /api/reels/comments/:commentId/likes
  async getCommentLikes(req, res) {
    try {
      const { commentId } = req.params;
      const userId        = req.user?.id;

      const result = await commentLikeService.getCommentLikes(commentId, userId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error('[CommentLike] getCommentLikes error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },

  // POST /api/reels/replies/:replyId/likes
  // Triggered: user taps the like button on a reply
  async toggleReplyLike(req, res) {
    try {
      const { replyId } = req.params;
      const userId      = req.user.id;

      const result = await commentLikeService.toggleReplyLike(replyId, userId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error('[CommentLike] toggleReplyLike error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },

  // GET /api/reels/replies/:replyId/likes
  async getReplyLikes(req, res) {
    try {
      const { replyId } = req.params;
      const userId      = req.user?.id;

      const result = await commentLikeService.getReplyLikes(replyId, userId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error('[CommentLike] getReplyLikes error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },
};

export default commentLikeController;
