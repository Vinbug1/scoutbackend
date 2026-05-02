import postService from '../services/postService.js';

const postController = {

  // CREATE a new post
  async createPost(req, res) {
    try {
      const { content, userId } = req.body;

      if (!content || !userId) {
        return res.status(400).json({ error: 'Content and userId are required' });
      }

      const post = await postService.createPost({ content, userId });
      res.status(201).json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while creating the post' });
    }
  },

  // READ all posts
  async getAllPosts(req, res) {
    try {
      const posts = await postService.getAllPosts();
      res.status(200).json(posts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while fetching posts' });
    }
  },

  // READ a single post by ID
  async getPostById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const post = await postService.getPostById(id);
      res.status(200).json(post);
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Something went wrong while fetching the post' });
    }
  },

  // UPDATE a post by ID
  async updatePost(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { content } = req.body;
      const updatedPost = await postService.updatePost(id, { content });
      res.status(200).json(updatedPost);
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Something went wrong while updating the post' });
    }
  },

  // DELETE a post by ID
  async deletePost(req, res) {
    try {
      const id = parseInt(req.params.id);
      await postService.deletePost(id);
      res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Something went wrong while deleting the post' });
    }
  },
};

export default postController;