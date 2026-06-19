import replyService from '../services/replyService.js';

const replyController = {

  async getReplies(req, res) {
    try {
      const commentId = Number(req.params.commentId);

      if (Number.isNaN(commentId)) {
        return res.status(400).json({ success: false, message: 'Invalid comment ID' });
      }

      const page     = Number(req.query.page)  || 1;
      const limit    = Number(req.query.limit) || 10;
      const viewerId = req.user?.userId ?? null; // ✅ auth sets userId

      const data = await replyService.getCommentReplies(commentId, { page, limit, viewerId });

      return res.status(200).json({ success: true, ...data });
    } catch (err) {
      console.error('[Reply] getReplies', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async createReply(req, res) {
    try {
      const commentId = Number(req.params.commentId);

      if (Number.isNaN(commentId)) {
        return res.status(400).json({ success: false, message: 'Invalid comment ID' });
      }

      const { text, mentionedUser } = req.body;
      const userId = req.user?.userId; // ✅ auth sets userId

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
      }

      if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'Reply text required' });
      }

      const reply = await replyService.addReply(commentId, userId, text.trim(), mentionedUser);

      return res.status(201).json({ success: true, reply });
    } catch (err) {
      console.error('[Reply] createReply', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

  async deleteReply(req, res) {
    try {
      const replyId = Number(req.params.replyId);

      if (Number.isNaN(replyId)) {
        return res.status(400).json({ success: false, message: 'Invalid reply ID' });
      }

      const userId = req.user?.userId; // ✅ auth sets userId

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
      }

      const result = await replyService.deleteReply(replyId, userId);

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[Reply] deleteReply', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
    }
  },

};

export default replyController;



























// import replyService from '../services/replyService.js';

// const replyController = {

//   // =========================================================
//   // GET replies
//   // =========================================================
//   async getReplies( req, res  ) {

//     try {

//       const commentId =
//         Number(
//           req.params.commentId
//         );

//       const page =
//         Number(
//           req.query.page
//         ) || 1;

//       const limit =
//         Number(
//           req.query.limit
//         ) || 10;

//       const viewerId =
//         req.user?.userId ??
//         null;

//       if (
//         Number.isNaN(
//           commentId
//         )
//       ) {
//         return res.status(400).json({
//           success:
//             false,

//           message:
//             'Invalid comment ID',
//         });
//       }

//       const data =
//         await replyService.getCommentReplies(
//           commentId,
//           {
//             page,
//             limit,
//             viewerId,
//           }
//         );

//       return res.status(200).json({
//         success:
//           true,

//         ...data,
//       });

//     } catch (err) {

//       console.error(
//         '[Reply] getReplies',
//         err
//       );

//       return res.status(
//         err.status ||
//           500
//       ).json({
//         success:
//           false,

//         message:
//           err.message ||
//           'Server error',
//       });

//     }

//   },

//   // =========================================================
//   // CREATE reply
//   // =========================================================
//   async createReply(
//     req,
//     res
//   ) {

//     try {

//       const commentId =
//         Number(
//           req.params.commentId
//         );

//       const {
//         text,
//         mentionedUser,
//       } =
//         req.body;

//       const userId =
//         req.user.userId;

//       if (
//         !text?.trim()
//       ) {
//         return res.status(400).json({
//           success:
//             false,

//           message:
//             'Reply text required',
//         });
//       }

//       const reply =
//         await replyService.addReply(
//           commentId,
//           userId,
//           text.trim(),
//           mentionedUser
//         );

//       return res.status(201).json({
//         success:
//           true,

//         reply,
//       });

//     } catch (err) {

//       console.error(
//         '[Reply] createReply',
//         err
//       );

//       return res.status(
//         err.status ||
//           500
//       ).json({
//         success:
//           false,

//         message:
//           err.message ||
//           'Server error',
//       });

//     }

//   },

//   // =========================================================
//   // DELETE reply
//   // =========================================================
//   async deleteReply(
//     req,
//     res
//   ) {

//     try {

//       const replyId =
//         Number(
//           req.params.replyId
//         );

//       const userId =
//         req.user.userId;

//       const result =
//         await replyService.deleteReply(
//           replyId,
//           userId
//         );

//       return res.status(200).json({
//         success:
//           true,

//         ...result,
//       });

//     } catch (err) {

//       console.error(
//         '[Reply] deleteReply',
//         err
//       );

//       return res.status(
//         err.status ||
//           500
//       ).json({
//         success:
//           false,

//         message:
//           err.message ||
//           'Server error',
//       });

//     }

//   },

// };

// export default replyController;



