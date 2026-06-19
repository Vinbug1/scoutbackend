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






















// // src/controllers/commentLikeController.js
// import commentLikeService from '../services/commentLikeService.js';

// const commentLikeController = {

//   // ─── Comment Likes ───────────────────────────────────────────────────────────

//   async toggleCommentLike(req, res) {
//     try {
//       const { commentId } = req.params;
//       const userId        = req.user?.userId; // ✅ was req.user.id

//       if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

//       const result = await commentLikeService.toggleCommentLike(commentId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] toggleCommentLike error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   async getCommentLikes(req, res) {
//     try {
//       const { commentId } = req.params;
//       const userId        = req.user?.userId; // ✅ was req.user?.id

//       const result = await commentLikeService.getCommentLikes(commentId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getCommentLikes error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   async getCommentLikesCount(req, res) {
//     try {
//       const { commentId } = req.params;

//       const result = await commentLikeService.getCommentLikesCount(commentId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getCommentLikesCount error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   // ─── Reply Likes ─────────────────────────────────────────────────────────────

//   async toggleReplyLike(req, res) {
//     try {
//       const { replyId } = req.params;
//       const userId      = req.user?.userId; // ✅ was req.user.id

//       if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

//       const result = await commentLikeService.toggleReplyLike(replyId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] toggleReplyLike error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   async getReplyLikes(req, res) {
//     try {
//       const { replyId } = req.params;
//       const userId      = req.user?.userId; // ✅ was req.user?.id

//       const result = await commentLikeService.getReplyLikes(replyId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getReplyLikes error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   // ─── Reel Likes ──────────────────────────────────────────────────────────────

//   async toggleReelLike(req, res) {
//     try {
//       const { reelId } = req.params;
//       const userId     = req.user?.userId; // ✅ was req.user.id

//       if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

//       const result = await commentLikeService.toggleReelLike(reelId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] toggleReelLike error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   async getReelLikes(req, res) {
//     try {
//       const { reelId } = req.params;
//       const userId     = req.user?.userId; // ✅ was req.user?.id

//       const result = await commentLikeService.getReelLikes(reelId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getReelLikes error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

//   async getReelLikesCount(req, res) {
//     try {
//       const { reelId } = req.params;

//       const result = await commentLikeService.getReelLikesCount(reelId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getReelLikesCount error:', err);
//       return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
//     }
//   },

// };

// export default commentLikeController;


















// // src/controllers/commentLikeController.js
// import commentLikeService from '../services/commentLikeService.js';

// const commentLikeController = {

//   // ─── Comment Likes ───────────────────────────────────────────────────────────

//   /**
//    * POST /api/likes/comments/:commentId/toggle
//    * Triggered: user taps the like button on a comment (auth required)
//    */
//   async toggleCommentLike(req, res) {
//     try {
//       const { commentId } = req.params;
//       const userId        = req.user.id;

//       const result = await commentLikeService.toggleCommentLike(commentId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] toggleCommentLike error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   /**
//    * GET /api/likes/comments/:commentId
//    * Get like count + current user's like status for a comment (auth optional)
//    */
//   async getCommentLikes(req, res) {
//     try {
//       const { commentId } = req.params;
//       const userId        = req.user?.id;

//       const result = await commentLikeService.getCommentLikes(commentId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getCommentLikes error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   /**
//    * GET /api/likes/comments/:commentId/count
//    * Get like count only for a comment — no auth required
//    */
//   async getCommentLikesCount(req, res) {
//     try {
//       const { commentId } = req.params;

//       const result = await commentLikeService.getCommentLikesCount(commentId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getCommentLikesCount error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   // ─── Reply Likes ─────────────────────────────────────────────────────────────

//   /**
//    * POST /api/likes/replies/:replyId/toggle
//    * Triggered: user taps the like button on a reply (auth required)
//    */
//   async toggleReplyLike(req, res) {
//     try {
//       const { replyId } = req.params;
//       const userId      = req.user.id;

//       const result = await commentLikeService.toggleReplyLike(replyId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] toggleReplyLike error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   /**
//    * GET /api/likes/replies/:replyId
//    * Get like count + current user's like status for a reply (auth optional)
//    */
//   async getReplyLikes(req, res) {
//     try {
//       const { replyId } = req.params;
//       const userId      = req.user?.id;

//       const result = await commentLikeService.getReplyLikes(replyId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getReplyLikes error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   // ─── Reel Likes ──────────────────────────────────────────────────────────────

//   /**
//    * POST /api/likes/reels/:reelId/toggle
//    * Triggered: user taps the like button on a reel (auth required)
//    */
//   async toggleReelLike(req, res) {
//     try {
//       const { reelId } = req.params;
//       const userId     = req.user.id;

//       const result = await commentLikeService.toggleReelLike(reelId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] toggleReelLike error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   /**
//    * GET /api/likes/reels/:reelId
//    * Get like count + current user's like status for a reel (auth optional)
//    */
//   async getReelLikes(req, res) {
//     try {
//       const { reelId } = req.params;
//       const userId     = req.user?.id;

//       const result = await commentLikeService.getReelLikes(reelId, userId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getReelLikes error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   /**
//    * GET /api/likes/reels/:reelId/count
//    * Get like count only for a reel — no auth required
//    */
//   async getReelLikesCount(req, res) {
//     try {
//       const { reelId } = req.params;

//       const result = await commentLikeService.getReelLikesCount(reelId);
//       return res.status(200).json({ success: true, data: result });
//     } catch (err) {
//       console.error('[CommentLike] getReelLikesCount error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },
// };

// export default commentLikeController;


