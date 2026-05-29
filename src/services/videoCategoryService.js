const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const videoCategoryService = {
  // Create a new category
  async create(title) {
    return prisma.videoCategory.create({
      data: { title },
    });
  },

  // Get all categories with video count
  async findAll() {
    return prisma.videoCategory.findMany({
      include: {
        _count: { select: { videos: true } },
      },
      orderBy: { title: "asc" },
    });
  },

  // Get a single category by ID, including its published videos
  async findById(id) {
    return prisma.videoCategory.findUnique({
      where: { id },
      include: {
        videos: {
          where: { published: true },
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            durationSec: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { videos: true } },
      },
    });
  },

  // Update a category title
  async update(id, title) {
    return prisma.videoCategory.update({
      where: { id },
      data: { title },
    });
  },

  // Delete a category
  async delete(id) {
    return prisma.videoCategory.delete({
      where: { id },
    });
  },
};

module.exports = { videoCategoryService };