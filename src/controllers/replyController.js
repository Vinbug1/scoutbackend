const replyService = require("./reply.service");

const replyController = {

    async getCommentReplies  (req, res) {
    try {
      const { commentId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
    
      const data = await replyService.getCommentReplies(commentId, { page, limit });
      return res.status(200).json({ success: true, ...data });
    } catch (err) {
      return res
        .status(err.status || 500)
        .json({ success: false, message: err.message || "Server error" });
    }
    },
    
    async addReply(req, res) {
    try {
      const { commentId } = req.params;
      const { text } = req.body;
      const userId = req.user.id;
    
      if (!text || !text.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Reply text is required" });
      }
    
      const reply = await replyService.addReply(commentId, userId, text.trim());
      return res.status(201).json({ success: true, reply });
    } catch (err) {
      return res
        .status(err.status || 500)
        .json({ success: false, message: err.message || "Server error" });
    }
    },
    
    async deleteReply(req, res) {
    try {
      const { replyId } = req.params;
      const userId = req.user.id;
    
      const result = await replyService.deleteReply(replyId, userId);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res
        .status(err.status || 500)
        .json({ success: false, message: err.message || "Server error" });
    }
    },
}


export default replyController;
