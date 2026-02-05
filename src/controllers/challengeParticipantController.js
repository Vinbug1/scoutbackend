import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const participantController = {
  // CREATE participant
  // async createParticipant(req, res) {
  //   try {
  //     const { challengeId, userId } = req.body;
  //     const participant = await prisma.challengeParticipant.create({
  //       data: { challengeId, userId }
  //     });
  //     res.status(201).json(participant);
  //   } catch (error) {
  //     if (error.code === 'P2002') {
  //       return res.status(400).json({ 
  //         message: "User already joined this challenge." 
  //       });
  //     }
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  async createParticipant(req, res) {
    try {
      const { challengeId, userId } = req.body;
      
      if (!challengeId || !userId) {
        return res.status(400).json({ 
          message: "challengeId and userId are required" 
        });
      }

      const challenge = await prisma.challenge.findUnique({
        where: { id: Number(challengeId) }
      });
      
      if (!challenge) {
        return res.status(404).json({ 
          message: "Challenge not found" 
        });
      }

      const participant = await prisma.challengeParticipant.create({
        data: { 
          challengeId: Number(challengeId), 
          userId: Number(userId),
          status: 'ACTIVE',
          progress: 0
        },
        include: { 
          user: { 
            select: { id: true, name: true, email: true } 
          }, 
          challenge: true 
        }
      });
      
      res.status(201).json(participant);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          message: "User already joined this challenge." 
        });
      }
      if (error.code === 'P2003') {
        return res.status(404).json({ 
          message: "User or Challenge not found" 
        });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // UPDATE participant progress
  async updateProgress(req, res) {
    try {
      const { id } = req.params;
      const { progressDelta, description, taskId } = req.body;

      if (progressDelta === undefined || !description) {
        return res.status(400).json({
          message: "progressDelta and description are required"
        });
      }

      // Get current participant
      const participant = await prisma.challengeParticipant.findUnique({
        where: { id: Number(id) },
        include: { challenge: true }
      });

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      if (participant.status === 'COMPLETED') {
        return res.status(400).json({ 
          message: "Challenge already completed" 
        });
      }

      // Calculate new progress
      const newProgress = Math.min(
        participant.progress + Number(progressDelta), 
        100
      );

      // Check if challenge is now complete
      const targetProgress = participant.challenge.targetProgress || 100;
      const isCompleted = newProgress >= targetProgress;

      // Update participant and create progress log in a transaction
      const [updatedParticipant, progressLog] = await prisma.$transaction([
        prisma.challengeParticipant.update({
          where: { id: Number(id) },
          data: {
            progress: newProgress,
            status: isCompleted ? 'COMPLETED' : participant.status,
            completedAt: isCompleted ? new Date() : null
          },
          include: {
            user: { 
              select: { id: true, name: true, email: true } 
            },
            challenge: true,
            progressLogs: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        }),
        prisma.progressLog.create({
          data: {
            participantId: Number(id),
            taskId: taskId ? Number(taskId) : null,
            description,
            progressDelta: Number(progressDelta)
          }
        })
      ]);

      res.json({
        participant: updatedParticipant,
        newLog: progressLog,
        message: isCompleted ? 'Congratulations! Challenge completed!' : 'Progress updated'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET participant progress with logs
  async getParticipantProgress(req, res) {
    try {
      const { id } = req.params;

      const participant = await prisma.challengeParticipant.findUnique({
        where: { id: Number(id) },
        include: {
          user: { 
            select: { id: true, name: true, email: true } 
          },
          challenge: true,
          progressLogs: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      res.json({
        participant,
        summary: {
          currentProgress: participant.progress,
          targetProgress: participant.challenge.targetProgress || 100,
          remaining: Math.max(0, (participant.challenge.targetProgress || 100) - participant.progress),
          status: participant.status,
          totalLogs: participant.progressLogs.length,
          joinedAt: participant.joinedAt,
          completedAt: participant.completedAt
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET all participants who completed a challenge
  async getCompletedParticipants(req, res) {
    try {
      const { challengeId } = req.params;
      const { sortBy = 'completedAt' } = req.query; // completedAt or progress

      const completedParticipants = await prisma.challengeParticipant.findMany({
        where: {
          challengeId: Number(challengeId),
          status: 'COMPLETED'
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          challenge: {
            select: { id: true, title: true, targetProgress: true }
          }
        },
        orderBy: sortBy === 'progress' 
          ? { progress: 'desc' }
          : { completedAt: 'asc' } // earliest completers first
      });

      res.json({
        challengeId: Number(challengeId),
        totalCompleted: completedParticipants.length,
        participants: completedParticipants.map((p, index) => ({
          rank: index + 1,
          participantId: p.id,
          user: p.user,
          progress: p.progress,
          joinedAt: p.joinedAt,
          completedAt: p.completedAt,
          timeToComplete: p.completedAt 
            ? Math.ceil((new Date(p.completedAt) - new Date(p.joinedAt)) / (1000 * 60 * 60 * 24)) // days
            : null
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET leaderboard for a challenge
  async getChallengeLeaderboard(req, res) {
    try {
      const { challengeId } = req.params;
      const { limit = 10, status = 'all' } = req.query;

      const whereClause = {
        challengeId: Number(challengeId)
      };

      if (status !== 'all') {
        whereClause.status = status.toUpperCase();
      }

      const leaderboard = await prisma.challengeParticipant.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { progressLogs: true }
          }
        },
        orderBy: [
          { progress: 'desc' },
          { completedAt: 'asc' } // tie-breaker: who completed first
        ],
        take: Number(limit)
      });

      res.json({
        challengeId: Number(challengeId),
        leaderboard: leaderboard.map((p, index) => ({
          rank: index + 1,
          participantId: p.id,
          user: p.user,
          progress: p.progress,
          status: p.status,
          completedAt: p.completedAt,
          totalActivities: p._count.progressLogs
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET user's progress across all challenges
  async getUserAllProgress(req, res) {
    try {
      const { userId } = req.params;

      const participations = await prisma.challengeParticipant.findMany({
        where: { userId: Number(userId) },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              description: true,
              startDate: true,
              endDate: true,
              targetProgress: true
            }
          },
          _count: {
            select: { progressLogs: true }
          }
        },
        orderBy: { joinedAt: 'desc' }
      });

      const stats = {
        total: participations.length,
        completed: participations.filter(p => p.status === 'COMPLETED').length,
        active: participations.filter(p => p.status === 'ACTIVE').length,
        dropped: participations.filter(p => p.status === 'DROPPED').length,
        averageProgress: participations.length > 0
          ? (participations.reduce((sum, p) => sum + p.progress, 0) / participations.length).toFixed(2)
          : 0
      };

      res.json({
        userId: Number(userId),
        stats,
        challenges: participations.map(p => ({
          participantId: p.id,
          challenge: p.challenge,
          progress: p.progress,
          status: p.status,
          joinedAt: p.joinedAt,
          completedAt: p.completedAt,
          totalActivities: p._count.progressLogs
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // MARK challenge as dropped/paused
  async updateParticipantStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['ACTIVE', 'COMPLETED', 'DROPPED', 'PAUSED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const participant = await prisma.challengeParticipant.update({
        where: { id: Number(id) },
        data: { status },
        include: {
          user: { select: { id: true, name: true, email: true } },
          challenge: true
        }
      });

      res.json({
        message: `Status updated to ${status}`,
        participant
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // GET challenge statistics
  async getChallengeStatistics(req, res) {
    try {
      const { challengeId } = req.params;

      const [challenge, participants, completedCount, averageProgress] = await Promise.all([
        prisma.challenge.findUnique({
          where: { id: Number(challengeId) }
        }),
        prisma.challengeParticipant.findMany({
          where: { challengeId: Number(challengeId) }
        }),
        prisma.challengeParticipant.count({
          where: {
            challengeId: Number(challengeId),
            status: 'COMPLETED'
          }
        }),
        prisma.challengeParticipant.aggregate({
          where: { challengeId: Number(challengeId) },
          _avg: { progress: true }
        })
      ]);

      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      const statusBreakdown = participants.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        challengeId: Number(challengeId),
        challengeTitle: challenge.title,
        statistics: {
          totalParticipants: participants.length,
          completedCount,
          completionRate: participants.length > 0 
            ? ((completedCount / participants.length) * 100).toFixed(2) + '%'
            : '0%',
          averageProgress: averageProgress._avg.progress?.toFixed(2) || 0,
          statusBreakdown,
          fastestCompletion: participants
            .filter(p => p.completedAt)
            .map(p => ({
              userId: p.userId,
              days: Math.ceil((new Date(p.completedAt) - new Date(p.joinedAt)) / (1000 * 60 * 60 * 24))
            }))
            .sort((a, b) => a.days - b.days)[0] || null
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET all participants
  async getAllParticipants(req, res) {
    try {
      const participants = await prisma.challengeParticipant.findMany({
        include: { user: true, challenge: true }
      });
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET participant by ID
  async getParticipantById(req, res) {
    try {
      const { id } = req.params;
      const participant = await prisma.challengeParticipant.findUnique({
        where: { id: Number(id) },
        include: { user: true, challenge: true }
      });
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // UPDATE participant
  async updateParticipant(req, res) {
    try {
      const { id } = req.params;
      const { challengeId, userId } = req.body;
      const participant = await prisma.challengeParticipant.update({
        where: { id: Number(id) },
        data: { challengeId, userId }
      });
      res.json(participant);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          message: "This user is already registered for the challenge."
        });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // DELETE participant
  async deleteParticipant(req, res) {
    try {
      const { id } = req.params;
      const participant = await prisma.challengeParticipant.delete({
        where: { id: Number(id) }
      });
      res.json({ message: "Participant removed", participant });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // EXTRA: Get all participants in a specific challenge
  async getParticipantsByChallenge(req, res) {
    try {
      const { challengeId } = req.params;
      const participants = await prisma.challengeParticipant.findMany({
        where: { challengeId: Number(challengeId) },
        include: { user: true }
      });
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // EXTRA: Get all challenges a user joined
  async getChallengesByUser(req, res) {
    try {
      const { userId } = req.params;
      const challenges = await prisma.challengeParticipant.findMany({
        where: { userId: Number(userId) },
        include: { challenge: true }
      });
      res.json(challenges);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

export default participantController;


