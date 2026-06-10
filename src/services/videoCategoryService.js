import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const videoCategoryService = {
  // Create a new category
  async create(title) {
    return prisma.videoCategory.create({
      data: { title },
    });
  },

  // Get all categories with reel count (optionally filter by categoryType)
  async findAll() {
    return prisma.videoCategory.findMany({
      include: {
        _count: { select: { reels: true } },  // ✅
      },
      orderBy: { title: 'asc' },
    });
  },

  // Get a single category by ID, including its published reels
  async findById(id) {
    return prisma.videoCategory.findUnique({
      where: { id },
      include: {
        reels: {                               // ✅
          where: { published: true },
          select: {
            id:           true,
            title:        true,
            thumbnailUrl: true,
            durationSec:  true,
            createdAt:    true,
            status:       true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { reels: true } },  // ✅
      },
    });
  },

  // Update a category
  async update(id, data) {
    return prisma.videoCategory.update({
      where: { id },
      data,
    });
  },

  // Delete a category
  async delete(id) {
    return prisma.videoCategory.delete({
      where: { id },
    });
  },
};





