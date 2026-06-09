import commentService from '../services/commentService.js';

const commentController = {

  // POST /api/comments
  async createComment(req, res) {
    try {
      const { text, userId, postId, videoId, reelId } = req.body;

      if (!text || !userId) {
        return res.status(400).json({ message: 'text and userId are required.' });
      }

      // Must belong to at least one of: post, video, or reel
      if (!postId && !videoId && !reelId) {
        return res.status(400).json({
          message: 'At least one of postId, videoId, or reelId is required.',
        });
      }

      const comment = await commentService.createComment({ text, userId, postId, videoId, reelId });
      return res.status(201).json(comment);
    } catch (error) {
      console.error('[Comment] createComment error:', error);
      if (error.code === 'P2003') {
        return res.status(400).json({ message: 'Referenced post, video, reel, or user does not exist.' });
      }
      return res.status(500).json({ message: 'Failed to create comment.' });
    }
  },

  // GET /api/comments?postId=1  OR  ?videoId=2  OR  ?reelId=3
  async getComments(req, res) {
    try {
      const { postId, videoId, reelId } = req.query;
      const comments = await commentService.getComments({ postId, videoId, reelId });
      return res.status(200).json(comments);
    } catch (error) {
      console.error('[Comment] getComments error:', error);
      return res.status(500).json({ message: 'Failed to fetch comments.' });
    }
  },

  // GET /api/comments/:id
  async getCommentById(req, res) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid comment ID.' });
      }

      const comment = await commentService.getCommentById(id);
      return res.status(200).json(comment);
    } catch (error) {
      console.error('[Comment] getCommentById error:', error);
      const status = error.statusCode || 500;
      return res.status(status).json({
        message: error.statusCode ? error.message : 'Failed to fetch comment.',
      });
    }
  },

  // PATCH /api/comments/:id
  async updateComment(req, res) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid comment ID.' });
      }

      const { text } = req.body;
      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ message: 'text is required.' });
      }

      const updated = await commentService.updateComment(id, { text: text.trim() });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('[Comment] updateComment error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Comment not found.' });
      }
      return res.status(500).json({ message: 'Failed to update comment.' });
    }
  },

  // DELETE /api/comments/:id
  async deleteComment(req, res) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid comment ID.' });
      }

      await commentService.deleteComment(id);
      return res.status(200).json({ message: 'Comment deleted successfully.' });
    } catch (error) {
      console.error('[Comment] deleteComment error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Comment not found.' });
      }
      return res.status(500).json({ message: 'Failed to delete comment.' });
    }
  },
};

export default commentController;


























// import commentService from '../services/commentService.js';

// const commentController = {

//   // Create a new comment
//   async createComment(req, res) {
//     try {
//       const { text, userId, postId, videoId } = req.body;

//       if (!text || !userId) {
//         return res.status(400).json({ message: 'text and userId are required' });
//       }
//       if (!postId && !videoId) {
//         return res.status(400).json({ message: 'Either postId or videoId is required' });
//       }

//       const comment = await commentService.createComment({ text, userId, postId, videoId });
//       return res.status(201).json(comment);
//     } catch (error) {
//       console.log(error);
//       return res.status(500).json({ message: 'Failed to create comment' });
//     }
//   },

//   // Get all comments (optional filter by post or video)
//   async getComments(req, res) {
//     try {
//       const { postId, videoId } = req.query;
//       const comments = await commentService.getComments({ postId, videoId });
//       return res.status(200).json(comments);
//     } catch (error) {
//       console.log(error);
//       return res.status(500).json({ message: 'Failed to fetch comments' });
//     }
//   },

//   // Get a single comment
//   async getCommentById(req, res) {
//     try {
//       const id = Number(req.params.id);
//       const comment = await commentService.getCommentById(id);
//       return res.status(200).json(comment);
//     } catch (error) {
//       console.log(error);
//       const status = error.statusCode || 500;
//       return res.status(status).json({ message: error.statusCode ? error.message : 'Failed to fetch comment' });
//     }
//   },

//   // Update comment
//   async updateComment(req, res) {
//     try {
//       const id = Number(req.params.id);
//       const { text } = req.body;

//       if (!text) {
//         return res.status(400).json({ message: 'text is required' });
//       }

//       const updated = await commentService.updateComment(id, { text });
//       return res.status(200).json(updated);
//     } catch (error) {
//       console.log(error);
//       if (error.code === 'P2025') {
//         return res.status(404).json({ message: 'Comment not found' });
//       }
//       return res.status(500).json({ message: 'Failed to update comment' });
//     }
//   },

//   // Delete comment
//   async deleteComment(req, res) {
//     try {
//       const id = Number(req.params.id);
//       await commentService.deleteComment(id);
//       return res.status(200).json({ message: 'Comment deleted successfully' });
//     } catch (error) {
//       console.log(error);
//       if (error.code === 'P2025') {
//         return res.status(404).json({ message: 'Comment not found' });
//       }
//       return res.status(500).json({ message: 'Failed to delete comment' });
//     }
//   }
// };

// export default commentController;