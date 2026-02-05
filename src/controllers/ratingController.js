import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const RatingController = {
  // Create a rating
  async createRating(req, res) {
    try {
      const { score, videoId, userId } = req.body;
      // Validate score
      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ error: "Score must be between 1 and 5" });
      }
      const rating = await prisma.rating.create({
        data: { score, videoId: Number(videoId), userId: Number(userId) }
      });
      return res.status(201).json(rating);
    } catch (err) {
      console.error(err);
      if (err.code === "P2002") {
        return res.status(400).json({ error: "You have already rated this video." });
      }
      return res.status(500).json({ error: "Server error" });
    }
  },

  // Get all ratings
  async getAllRatings(req, res) {
    try {
      const ratings = await prisma.rating.findMany({
        include: { user: true, video: true }
      });
      return res.status(200).json(ratings);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  },

  // Get rating by ID
  async getRatingById(req, res) {
    try {
      const { id } = req.params;
      const rating = await prisma.rating.findUnique({
        where: { id: Number(id) },
        include: { user: true, video: true }
      });
      if (!rating) {
        return res.status(404).json({ error: "Rating not found" });
      }
      return res.status(200).json(rating);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  },

  // Update rating
  async updateRating(req, res) {
    try {
      const { id } = req.params;
      const { score } = req.body;
      if (score < 1 || score > 5) {
        return res.status(400).json({ error: "Score must be between 1 and 5" });
      }
      const rating = await prisma.rating.update({
        where: { id: Number(id) },
        data: { score }
      });
      return res.status(200).json(rating);
    } catch (err) {
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Rating not found" });
      }
      return res.status(500).json({ error: "Server error" });
    }
  },

  // Delete rating
  async deleteRating(req, res) {
    try {
      const { id } = req.params;
      await prisma.rating.delete({
        where: { id: Number(id) }
      });
      return res.status(200).json({ message: "Rating deleted successfully" });
    } catch (err) {
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Rating not found" });
      }
      return res.status(500).json({ error: "Server error" });
    }
  }
};

export default RatingController;














// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient();

// const RatingController  = {
//   // Create a rating
//   async createRating(req, res) {
//     try {
//       const { score, videoId, userId } = req.body;

//       // Validate score
//       if (!score || score < 1 || score > 5) {
//         return res.status(400).json({ error: "Score must be between 1 and 5" });
//       }

//       const rating = await prisma.rating.create({
//         data: { score, videoId: Number(videoId), userId: Number(userId) }
//       });

//       return res.status(201).json(rating);
//     } catch (err) {
//       console.error(err);

//       if (err.code === "P2002") {
//         return res.status(400).json({ error: "You have already rated this video." });
//       }

//       return res.status(500).json({ error: "Server error" });
//     }
//   },

//   // Get all ratings
//   async getAllRatings(req, res) {
//     try {
//       const ratings = await prisma.rating.findMany({
//         include: { user: true, video: true }
//       });

//       return res.status(200).json(ratings);
//     } catch (err) {
//       return res.status(500).json({ error: "Server error" });
//     }
//   },

//   // Get rating by ID
//   async getRatingById(req, res) {
//     try {
//       const { id } = req.params;

//       const rating = await prisma.rating.findUnique({
//         where: { id: Number(id) },
//         include: { user: true, video: true }
//       });

//       if (!rating) {
//         return res.status(404).json({ error: "Rating not found" });
//       }

//       return res.status(200).json(rating);
//     } catch (err) {
//       return res.status(500).json({ error: "Server error" });
//     }
//   },

//   // Update rating
//   async updateRating(req, res) {
//     try {
//       const { id } = req.params;
//       const { score } = req.body;

//       if (score < 1 || score > 5) {
//         return res.status(400).json({ error: "Score must be between 1 and 5" });
//       }

//       const rating = await prisma.rating.update({
//         where: { id: Number(id) },
//         data: { score }
//       });

//       return res.status(200).json(rating);
//     } catch (err) {
//       if (err.code === "P2025") {
//         return res.status(404).json({ error: "Rating not found" });
//       }
//       return res.status(500).json({ error: "Server error" });
//     }
//   },

//   // Delete rating
//   async deleteRating(req, res) {
//     try {
//       const { id } = req.params;

//       await prisma.rating.delete({
//         where: { id: Number(id) }
//       });

//       return res.status(200).json({ message: "Rating deleted successfully" });
//     } catch (err) {
//       if (err.code === "P2025") {
//         return res.status(404).json({ error: "Rating not found" });
//       }
//       return res.status(500).json({ error: "Server error" });
//     }
//   }
// }

// // Export an instance of the controller
// module.exports = new RatingController();
