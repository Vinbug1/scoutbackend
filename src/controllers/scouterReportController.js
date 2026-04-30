import scouterReportService from '../services/scouterReportService.js';

const scouterReportController = {

  async create(req, res) {
    try {
      const { scouterId, playerId } = req.body;
      if (!scouterId || !playerId) {
        return res.status(400).json({ error: 'scouterId and playerId are required' });
      }

      const report = await scouterReportService.create(req.body);
      res.status(201).json({ message: 'Report created successfully', data: report });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to create report' });
    }
  },

  async getAll(req, res) {
    try {
      const result = await scouterReportService.getAll(req.query);
      res.status(200).json(result);
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch reports' });
    }
  },

  async getById(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });

      const report = await scouterReportService.getById(id);
      res.status(200).json({ data: report });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch report' });
    }
  },

  async update(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });

      const { scouterId, ...updateData } = req.body;
      const report = await scouterReportService.update(id, scouterId, updateData);
      res.status(200).json({ message: 'Report updated successfully', data: report });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to update report' });
    }
  },

  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });

      await scouterReportService.delete(id);
      res.status(200).json({ message: 'Report deleted successfully' });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to delete report' });
    }
  },
};

export default scouterReportController;




















// import prisma from '../lib/prisma.js';

// const scouterReportController = {

//   // CREATE a new ScouterReport
//   async create(req, res) {
//     try {
//       const {
//         scouterId,
//         playerId,
//         // 1. Match Info
//         matchScouted,
//         ageGroup,
//         timesSeen,
//         currentClub,
//         // 2. Overall Assessment
//         overallAssessment,
//         // 3A. Technical
//         firstTouch, ballControl, dribbling, passingShort, passingLong,
//         throughBalls, smartPass, shooting, heading, tackling, weakerFoot,
//         // 3B. Tactical
//         positionalAwareness, decisionMaking, movementOffBall,
//         gameIntelligence, transitions,
//         // 3C. Physical
//         pace, agilityBalance, strength, staminaWorkRate, jumpingRate,
//         // 3D. Psychological
//         composure, braveryCommitment, determination,
//         leadershipCommunication, coachability,
//         // 4 & 5. Summaries
//         keyStrengths,
//         areasForDevelopment,
//         // 6. Recommendation
//         recommendation,
//       } = req.body;

//       if (!scouterId || !playerId) {
//         return res.status(400).json({ error: 'scouterId and playerId are required' });
//       }

//       // Verify scouter exists and has SCOUT role
//       const scouter = await prisma.user.findUnique({ where: { id: parseInt(scouterId) } });
//       if (!scouter || scouter.role !== 'SCOUT') {
//         return res.status(403).json({ error: 'Only scouts can file reports' });
//       }

//       // Verify player exists and has PLAYER role
//       const player = await prisma.user.findUnique({ where: { id: parseInt(playerId) } });
//       if (!player || player.role !== 'PLAYER') {
//         return res.status(404).json({ error: 'Player not found' });
//       }

//       const newReport = await prisma.scouterReport.create({
//         data: {
//           scouterId: parseInt(scouterId),
//           playerId: parseInt(playerId),
//           matchScouted,
//           ageGroup,
//           timesSeen: timesSeen ? parseInt(timesSeen) : null,
//           currentClub,
//           overallAssessment,
//           // 3A. Technical
//           firstTouch, ballControl, dribbling, passingShort, passingLong,
//           throughBalls, smartPass, shooting, heading, tackling, weakerFoot,
//           // 3B. Tactical
//           positionalAwareness, decisionMaking, movementOffBall,
//           gameIntelligence, transitions,
//           // 3C. Physical
//           pace, agilityBalance, strength, staminaWorkRate, jumpingRate,
//           // 3D. Psychological
//           composure, braveryCommitment, determination,
//           leadershipCommunication, coachability,
//           // 4 & 5. Summaries
//           keyStrengths: keyStrengths ?? [],
//           areasForDevelopment: areasForDevelopment ?? [],
//           recommendation: recommendation ?? null,
//         },
//         include: {
//           scouter: { select: { id: true, fullname: true, email: true } },
//           player: {
//             select: {
//               id: true, fullname: true, email: true,
//               profile: {
//                 select: { position: true, height: true, dob: true, country: true, city: true }
//               }
//             }
//           },
//         },
//       });

//       res.status(201).json({ message: 'Report created successfully', data: newReport });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to create report' });
//     }
//   },

//   // GET ALL ScouterReports (with optional filters)
//   async getAll(req, res) {
//     try {
//       const { scouterId, playerId, recommendation, page = 1, limit = 10 } = req.query;

//       const where = {};
//       if (scouterId) where.scouterId = parseInt(scouterId);
//       if (playerId) where.playerId = parseInt(playerId);
//       if (recommendation) where.recommendation = recommendation; // e.g. RECOMMEND_FOR_TRIAL

//       const skip = (parseInt(page) - 1) * parseInt(limit);
//       const take = parseInt(limit);

//       const [reports, total] = await Promise.all([
//         prisma.scouterReport.findMany({
//           where,
//           skip,
//           take,
//           orderBy: { createdAt: 'desc' },
//           include: {
//             scouter: { select: { id: true, fullname: true, email: true } },
//             player: {
//               select: {
//                 id: true, fullname: true, email: true,
//                 profile: {
//                   select: { position: true, height: true, dob: true, country: true, city: true }
//                 }
//               }
//             },
//           },
//         }),
//         prisma.scouterReport.count({ where }),
//       ]);

//       res.status(200).json({
//         data: reports,
//         meta: {
//           total,
//           page: parseInt(page),
//           limit: take,
//           totalPages: Math.ceil(total / take),
//         },
//       });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to fetch reports' });
//     }
//   },

//   // GET a single ScouterReport by ID
//   async getById(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       if (isNaN(id)) {
//         return res.status(400).json({ error: 'Invalid report ID' });
//       }

//       const report = await prisma.scouterReport.findUnique({
//         where: { id },
//         include: {
//           scouter: { select: { id: true, fullname: true, email: true } },
//           player: {
//             select: {
//               id: true, fullname: true, email: true,
//               profile: {
//                 select: { position: true, height: true, dob: true, country: true, city: true }
//               }
//             }
//           },
//         },
//       });

//       if (!report) {
//         return res.status(404).json({ error: 'Report not found' });
//       }

//       res.status(200).json({ data: report });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to fetch report' });
//     }
//   },

//   // UPDATE a ScouterReport
//   async update(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       if (isNaN(id)) {
//         return res.status(400).json({ error: 'Invalid report ID' });
//       }

//       const existing = await prisma.scouterReport.findUnique({ where: { id } });
//       if (!existing) {
//         return res.status(404).json({ error: 'Report not found' });
//       }

//       // Only allow the scouter who filed it to update it
//       const requestingScouterId = parseInt(req.body.scouterId);
//       if (existing.scouterId !== requestingScouterId) {
//         return res.status(403).json({ error: 'You can only update your own reports' });
//       }

//       const {
//         matchScouted, ageGroup, timesSeen, currentClub, overallAssessment,
//         firstTouch, ballControl, dribbling, passingShort, passingLong,
//         throughBalls, smartPass, shooting, heading, tackling, weakerFoot,
//         positionalAwareness, decisionMaking, movementOffBall,
//         gameIntelligence, transitions,
//         pace, agilityBalance, strength, staminaWorkRate, jumpingRate,
//         composure, braveryCommitment, determination,
//         leadershipCommunication, coachability,
//         keyStrengths, areasForDevelopment, recommendation,
//       } = req.body;

//       const updatedReport = await prisma.scouterReport.update({
//         where: { id },
//         data: {
//           matchScouted, ageGroup, currentClub, overallAssessment,
//           timesSeen: timesSeen ? parseInt(timesSeen) : undefined,
//           firstTouch, ballControl, dribbling, passingShort, passingLong,
//           throughBalls, smartPass, shooting, heading, tackling, weakerFoot,
//           positionalAwareness, decisionMaking, movementOffBall,
//           gameIntelligence, transitions,
//           pace, agilityBalance, strength, staminaWorkRate, jumpingRate,
//           composure, braveryCommitment, determination,
//           leadershipCommunication, coachability,
//           keyStrengths, areasForDevelopment, recommendation,
//         },
//       });

//       res.status(200).json({ message: 'Report updated successfully', data: updatedReport });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to update report' });
//     }
//   },

//   // DELETE a ScouterReport
//   async delete(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       if (isNaN(id)) {
//         return res.status(400).json({ error: 'Invalid report ID' });
//       }

//       const existing = await prisma.scouterReport.findUnique({ where: { id } });
//       if (!existing) {
//         return res.status(404).json({ error: 'Report not found' });
//       }

//       await prisma.scouterReport.delete({ where: { id } });
//       res.status(200).json({ message: 'Report deleted successfully' });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to delete report' });
//     }
//   },
// };

// export default scouterReportController;

















// import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// // const prisma = new PrismaClient();

// const scouterReportController = {
//   // CREATE a new ScouterReport
// async create(req, res) {
//   try {
//     const { scouterId, playerId, title, report } = req.body;

//     // 👇 Guard: make sure both users exist
//     if (!scouterId || !playerId || !report) {
//       return res.status(400).json({ error: 'scouterId, playerId and report are required' });
//     }

//     const newReport = await prisma.scouterReport.create({
//       data: {
//         scouterId: parseInt(scouterId),
//         playerId: parseInt(playerId),
//         title,
//         report,
//       },
//       include: {
//         scouter: { select: { id: true, fullname: true, email: true } },
//         player: { select: { id: true, fullname: true, email: true } },
//       }
//     });

//     res.status(201).json({ message: 'Report created successfully', data: newReport });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to create report' });
//   }
// },

// // GET ALL ScouterReports
// async getAll(req, res) {
//   try {
//     const { scouterId, playerId, page = 1, limit = 10 } = req.query;

//     const where = {};
//     if (scouterId) where.scouterId = parseInt(scouterId);
//     if (playerId) where.playerId = parseInt(playerId);

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);

//     const [reports, total] = await Promise.all([
//       prisma.scouterReport.findMany({
//         where,
//         skip,
//         take,
//         orderBy: { createdAt: 'desc' },
//         include: {
//           scouter: { select: { id: true, fullname: true, email: true } },
//           player: { select: { id: true, fullname: true, email: true } },
//         },
//       }),
//       prisma.scouterReport.count({ where }),
//     ]);

//     res.status(200).json({
//       data: reports,
//       meta: {
//         total,
//         page: parseInt(page),
//         limit: take,
//         totalPages: Math.ceil(total / take),
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch reports' });
//   }
// },

// // GET a single ScouterReport by ID
// async getById(req, res) {
//   try {
//     const id = parseInt(req.params.id);

//     if (isNaN(id)) {
//       return res.status(400).json({ error: 'Invalid report ID' });
//     }

//     const report = await prisma.scouterReport.findUnique({
//       where: { id },
//       include: {
//         scouter: { select: { id: true, fullname: true, email: true } },
//         player: { select: { id: true, fullname: true, email: true } },
//       },
//     });

//     if (!report) {
//       return res.status(404).json({ error: 'Report not found' });
//     }

//     res.status(200).json({ data: report });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch report' });
//   }
// },

// // UPDATE a ScouterReport
// async update(req, res) {
//   try {
//     const id = parseInt(req.params.id);
//     const { title, report } = req.body;

//     if (isNaN(id)) {
//       return res.status(400).json({ error: 'Invalid report ID' });
//     }

//     // 👇 Guard: check report exists before updating
//     const existing = await prisma.scouterReport.findUnique({ where: { id } });
//     if (!existing) {
//       return res.status(404).json({ error: 'Report not found' });
//     }

//     const updatedReport = await prisma.scouterReport.update({
//       where: { id },
//       data: { title, report },
//     });

//     res.status(200).json({ message: 'Report updated successfully', data: updatedReport });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to update report' });
//   }
// },

// // DELETE a ScouterReport
// async delete(req, res) {
//   try {
//     const id = parseInt(req.params.id);

//     if (isNaN(id)) {
//       return res.status(400).json({ error: 'Invalid report ID' });
//     }

//     // 👇 Guard: check report exists before deleting
//     const existing = await prisma.scouterReport.findUnique({ where: { id } });
//     if (!existing) {
//       return res.status(404).json({ error: 'Report not found' });
//     }

//     await prisma.scouterReport.delete({ where: { id } });
//     res.status(200).json({ message: 'Report deleted successfully' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to delete report' });
//   }
// }
// };

// export default scouterReportController;