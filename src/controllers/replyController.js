import replyService from '../services/replyService.js';

const replyController = {

  // =========================================================
  // GET replies
  // =========================================================
  async getReplies(
    req,
    res
  ) {

    try {

      const commentId =
        Number(
          req.params.commentId
        );

      const page =
        Number(
          req.query.page
        ) || 1;

      const limit =
        Number(
          req.query.limit
        ) || 10;

      const viewerId =
        req.user?.userId ??
        null;

      if (
        Number.isNaN(
          commentId
        )
      ) {
        return res.status(400).json({
          success:
            false,

          message:
            'Invalid comment ID',
        });
      }

      const data =
        await replyService.getCommentReplies(
          commentId,
          {
            page,
            limit,
            viewerId,
          }
        );

      return res.status(200).json({
        success:
          true,

        ...data,
      });

    } catch (err) {

      console.error(
        '[Reply] getReplies',
        err
      );

      return res.status(
        err.status ||
          500
      ).json({
        success:
          false,

        message:
          err.message ||
          'Server error',
      });

    }

  },

  // =========================================================
  // CREATE reply
  // =========================================================
  async createReply(
    req,
    res
  ) {

    try {

      const commentId =
        Number(
          req.params.commentId
        );

      const {
        text,
        mentionedUser,
      } =
        req.body;

      const userId =
        req.user.userId;

      if (
        !text?.trim()
      ) {
        return res.status(400).json({
          success:
            false,

          message:
            'Reply text required',
        });
      }

      const reply =
        await replyService.addReply(
          commentId,
          userId,
          text.trim(),
          mentionedUser
        );

      return res.status(201).json({
        success:
          true,

        reply,
      });

    } catch (err) {

      console.error(
        '[Reply] createReply',
        err
      );

      return res.status(
        err.status ||
          500
      ).json({
        success:
          false,

        message:
          err.message ||
          'Server error',
      });

    }

  },

  // =========================================================
  // DELETE reply
  // =========================================================
  async deleteReply(
    req,
    res
  ) {

    try {

      const replyId =
        Number(
          req.params.replyId
        );

      const userId =
        req.user.userId;

      const result =
        await replyService.deleteReply(
          replyId,
          userId
        );

      return res.status(200).json({
        success:
          true,

        ...result,
      });

    } catch (err) {

      console.error(
        '[Reply] deleteReply',
        err
      );

      return res.status(
        err.status ||
          500
      ).json({
        success:
          false,

        message:
          err.message ||
          'Server error',
      });

    }

  },

};

export default replyController;

























// // src/controllers/replyController.js
// import replyService from '../services/replyService.js';

// const replyController = {

//   // GET /api/reels/comments/:commentId/replies?page=1&limit=10
//   // Triggered: user taps "View X replies" under a comment
//   async getReplies(req, res) {
//     try {
//       const { commentId } = req.params;
//       const page  = parseInt(req.query.page,  10) || 1;
//       const limit = parseInt(req.query.limit, 10) || 10;

//       const data = await replyService.getCommentReplies(commentId, { page, limit });
//       return res.status(200).json({ success: true, ...data });
//     } catch (err) {
//       console.error('[Reply] getReplies error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   // POST /api/reels/comments/:commentId/replies
//   // Triggered: user taps reply on a comment or on a reply (e.g. "@Vincent Williams" tap)
//   // Body: { text: string, mentionedUser?: string }
//   async createReply(req, res) {
//     try {
//       const { commentId }                  = req.params;
//       const { text, mentionedUser = null } = req.body;
//       const userId                         = req.user.id;

//       if (!text || !text.trim()) {
//         return res.status(400).json({ success: false, message: 'Reply text is required.' });
//       }

//       const reply = await replyService.addReply(commentId, userId, text.trim(), mentionedUser);
//       return res.status(201).json({ success: true, reply });
//     } catch (err) {
//       console.error('[Reply] createReply error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },

//   // DELETE /api/reels/replies/:replyId
//   // Triggered: user deletes their own reply
//   async deleteReply(req, res) {
//     try {
//       const { replyId } = req.params;
//       const userId      = req.user.id;

//       const result = await replyService.deleteReply(replyId, userId);
//       return res.status(200).json({ success: true, ...result });
//     } catch (err) {
//       console.error('[Reply] deleteReply error:', err);
//       return res.status(err.status || 500).json({
//         success: false,
//         message: err.message || 'Server error',
//       });
//     }
//   },
// };

// export default replyController;

























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
