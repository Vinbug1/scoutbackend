import ParticipantService from '../services/participantService.js';

const ParticipantController = {

    // =============================
    // Create Participant
    // =============================
    async createParticipant(req, res) {
        try {
            const { challengeId, userId } = req.body;

            if (!challengeId || !userId) {
                return res.status(400).json({ message: "challengeId and userId are required" });
            }

            const result = await ParticipantService.createParticipant({ challengeId, userId });

            if (result.notFound) {
                return res.status(404).json({ message: "Challenge not found" });
            }

            res.status(201).json(result.participant);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ message: "User already joined this challenge." });
            }
            if (error.code === 'P2003') {
                return res.status(404).json({ message: "User or Challenge not found" });
            }
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Update Progress
    // =============================
    async updateProgress(req, res) {
        try {
            const { id } = req.params;
            const { progressDelta, description, taskId } = req.body;

            if (progressDelta === undefined || !description) {
                return res.status(400).json({ message: "progressDelta and description are required" });
            }

            const result = await ParticipantService.updateProgress(id, { progressDelta, description, taskId });

            if (result.notFound) {
                return res.status(404).json({ message: "Participant not found" });
            }
            if (result.alreadyCompleted) {
                return res.status(400).json({ message: "Challenge already completed" });
            }

            res.json({
                participant: result.updatedParticipant,
                newLog: result.progressLog,
                message: result.isCompleted ? 'Congratulations! Challenge completed!' : 'Progress updated'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Get Participant Progress
    // =============================
    async getParticipantProgress(req, res) {
        try {
            const { id } = req.params;

            const participant = await ParticipantService.getParticipantProgress(id);

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

    // =============================
    // Get Completed Participants
    // =============================
    async getCompletedParticipants(req, res) {
        try {
            const { challengeId } = req.params;
            const { sortBy = 'completedAt' } = req.query;

            const completedParticipants = await ParticipantService.getCompletedParticipants(challengeId, sortBy);

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
                        ? Math.ceil((new Date(p.completedAt) - new Date(p.joinedAt)) / (1000 * 60 * 60 * 24))
                        : null
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Get Challenge Leaderboard
    // =============================
    async getChallengeLeaderboard(req, res) {
        try {
            const { challengeId } = req.params;
            const { limit = 10, status = 'all' } = req.query;

            const leaderboard = await ParticipantService.getChallengeLeaderboard(challengeId, { limit, status });

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

    // =============================
    // Get User All Progress
    // =============================
    async getUserAllProgress(req, res) {
        try {
            const { userId } = req.params;

            const participations = await ParticipantService.getUserAllProgress(userId);

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

    // =============================
    // Update Participant Status
    // =============================
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

            const participant = await ParticipantService.updateParticipantStatus(id, status);

            res.json({ message: `Status updated to ${status}`, participant });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ message: "Participant not found" });
            }
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Get Challenge Statistics
    // =============================
    async getChallengeStatistics(req, res) {
        try {
            const { challengeId } = req.params;

            const { challenge, participants, completedCount, averageProgress } =
                await ParticipantService.getChallengeStatistics(challengeId);

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

    // =============================
    // Get All Participants
    // =============================
    async getAllParticipants(req, res) {
        try {
            const participants = await ParticipantService.getAllParticipants();
            res.json(participants);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Get Participant By ID
    // =============================
    async getParticipantById(req, res) {
        try {
            const { id } = req.params;
            const participant = await ParticipantService.getParticipantById(id);

            if (!participant) {
                return res.status(404).json({ message: "Participant not found" });
            }

            res.json(participant);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Update Participant
    // =============================
    async updateParticipant(req, res) {
        try {
            const { id } = req.params;
            const { challengeId, userId } = req.body;

            const participant = await ParticipantService.updateParticipant(id, { challengeId, userId });
            res.json(participant);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ message: "This user is already registered for the challenge." });
            }
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Delete Participant
    // =============================
    async deleteParticipant(req, res) {
        try {
            const { id } = req.params;
            const participant = await ParticipantService.deleteParticipant(id);
            res.json({ message: "Participant removed", participant });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Get Participants By Challenge
    // =============================
    async getParticipantsByChallenge(req, res) {
        try {
            const { challengeId } = req.params;
            const participants = await ParticipantService.getParticipantsByChallenge(challengeId);
            res.json(participants);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============================
    // Get Challenges By User
    // =============================
    async getChallengesByUser(req, res) {
        try {
            const { userId } = req.params;
            const challenges = await ParticipantService.getChallengesByUser(userId);
            res.json(challenges);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

export default ParticipantController;



