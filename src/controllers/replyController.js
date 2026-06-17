// src/controllers/replyController.js
import replyService from '../services/replyService.js';

const replyController = {

  // GET /api/reels/comments/:commentId/replies?page=1&limit=10
  // Triggered: user taps "View X replies" under a comment
  async getReplies(req, res) {
    try {
      const { commentId } = req.params;
      const page  = parseInt(req.query.page,  10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;

      const data = await replyService.getCommentReplies(commentId, { page, limit });
      return res.status(200).json({ success: true, ...data });
    } catch (err) {
      console.error('[Reply] getReplies error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },

  // POST /api/reels/comments/:commentId/replies
  // Triggered: user taps reply on a comment or on a reply (e.g. "@Vincent Williams" tap)
  // Body: { text: string, mentionedUser?: string }
  async createReply(req, res) {
    try {
      const { commentId }                  = req.params;
      const { text, mentionedUser = null } = req.body;
      const userId                         = req.user.id;

      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, message: 'Reply text is required.' });
      }

      const reply = await replyService.addReply(commentId, userId, text.trim(), mentionedUser);
      return res.status(201).json({ success: true, reply });
    } catch (err) {
      console.error('[Reply] createReply error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },

  // DELETE /api/reels/replies/:replyId
  // Triggered: user deletes their own reply
  async deleteReply(req, res) {
    try {
      const { replyId } = req.params;
      const userId      = req.user.id;

      const result = await replyService.deleteReply(replyId, userId);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[Reply] deleteReply error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Server error',
      });
    }
  },
};

export default replyController;

























// const replyService = require("./reply.service");

// const replyController = {

//     async getCommentReplies  (req, res) {
//     try {
//       const { commentId } = req.params;
//       const page = parseInt(req.query.page) || 1;
//       const limit = parseInt(req.query.limit) || 10;
    
//       const data = await replyService.getCommentReplies(commentId, { page, limit });
//       return res.status(200).json({ success: true, ...data });
//     } catch (err) {
//       return res
//         .status(err.status || 500)
//         .json({ success: false, message: err.message || "Server error" });
//     }
//     },
    
//     async addReply(req, res) {
//     try {
//       const { commentId } = req.params;
//       const { text } = req.body;
//       const userId = req.user.id;
    
//       if (!text || !text.trim()) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Reply text is required" });
//       }
    
//       const reply = await replyService.addReply(commentId, userId, text.trim());
//       return res.status(201).json({ success: true, reply });
//     } catch (err) {
//       return res
//         .status(err.status || 500)
//         .json({ success: false, message: err.message || "Server error" });
//     }
//     },
    
//     async deleteReply(req, res) {
//     try {
//       const { replyId } = req.params;
//       const userId = req.user.id;
    
//       const result = await replyService.deleteReply(replyId, userId);
//       return res.status(200).json({ success: true, ...result });
//     } catch (err) {
//       return res
//         .status(err.status || 500)
//         .json({ success: false, message: err.message || "Server error" });
//     }
//     },
// }


// export default replyController;
