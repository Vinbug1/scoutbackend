import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const PostController = {
  // CREATE a new post
  async createPost(req, res) {
    try {
      const { content, userId } = req.body;
      if (!content || !userId) {
        return res.status(400).json({ error: 'Content and userId are required' });
      }
      const post = await prisma.post.create({
        data: {
          content,
          userId: parseInt(userId),
        },
      });
      res.status(201).json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while creating the post' });
    }
  },

  // READ all posts
  async getAllPosts(req, res) {
    try {
      const posts = await prisma.post.findMany({
        include: {
          user: true,
          comments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      res.status(200).json(posts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while fetching posts' });
    }
  },

  // READ a single post by ID
  async getPostById(req, res) {
    try {
      const { id } = req.params;
      const post = await prisma.post.findUnique({
        where: { id: parseInt(id) },
        include: { user: true, comments: true },
      });
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.status(200).json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while fetching the post' });
    }
  },

  // UPDATE a post by ID
  async updatePost(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const existingPost = await prisma.post.findUnique({
        where: { id: parseInt(id) },
      });
      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const updatedPost = await prisma.post.update({
        where: { id: parseInt(id) },
        data: { content },
      });
      res.status(200).json(updatedPost);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while updating the post' });
    }
  },

  // DELETE a post by ID
  async deletePost(req, res) {
    try {
      const { id } = req.params;
      const existingPost = await prisma.post.findUnique({
        where: { id: parseInt(id) },
      });
      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }
      await prisma.post.delete({
        where: { id: parseInt(id) },
      });
      res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong while deleting the post' });
    }
  }
};

export default PostController;