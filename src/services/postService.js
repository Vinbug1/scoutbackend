import prisma from '../lib/prisma.js';

const postService = {

  async createPost({ content, userId }) {
    return prisma.post.create({
      data: {
        content,
        userId: parseInt(userId),
      },
    });
  },

  async getAllPosts() {
    return prisma.post.findMany({
      include: {
        user: true,
        comments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async getPostById(id) {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { user: true, comments: true },
    });

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    return post;
  },

  async updatePost(id, { content }) {
    const existing = await prisma.post.findUnique({ where: { id } });

    if (!existing) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.post.update({
      where: { id },
      data: { content },
    });
  },

  async deletePost(id) {
    const existing = await prisma.post.findUnique({ where: { id } });

    if (!existing) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    await prisma.post.delete({ where: { id } });
  },
};

export default postService;