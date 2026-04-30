import prisma from '../lib/prisma.js';

const participantService = {

    // =============================
    // Create a Participant
    // =============================
    async createParticipant({ challengeId, userId }) {
        const challenge = await prisma.challenge.findUnique({
            where: { id: Number(challengeId) }
        });

        if (!challenge) return { notFound: true };

        const participant = await prisma.challengeParticipant.create({
            data: {
                challengeId: Number(challengeId),
                userId: Number(userId),
                status: 'ACTIVE',
                progress: 0
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                challenge: true
            }
        });

        return { participant };
    },

    // =============================
    // Update Progress
    // =============================
    async updateProgress(id, { progressDelta, description, taskId }) {
        const participant = await prisma.challengeParticipant.findUnique({
            where: { id: Number(id) },
            include: { challenge: true }
        });

        if (!participant) return { notFound: true };
        if (participant.status === 'COMPLETED') return { alreadyCompleted: true };

        const newProgress = Math.min(participant.progress + Number(progressDelta), 100);
        const targetProgress = participant.challenge.targetProgress || 100;
        const isCompleted = newProgress >= targetProgress;

        const [updatedParticipant, progressLog] = await prisma.$transaction([
            prisma.challengeParticipant.update({
                where: { id: Number(id) },
                data: {
                    progress: newProgress,
                    status: isCompleted ? 'COMPLETED' : participant.status,
                    completedAt: isCompleted ? new Date() : null
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
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

        return { updatedParticipant, progressLog, isCompleted };
    },

    // =============================
    // Get Participant Progress
    // =============================
    async getParticipantProgress(id) {
        return await prisma.challengeParticipant.findUnique({
            where: { id: Number(id) },
            include: {
                user: { select: { id: true, name: true, email: true } },
                challenge: true,
                progressLogs: { orderBy: { createdAt: 'desc' } }
            }
        });
    },

    // =============================
    // Get Completed Participants
    // =============================
    async getCompletedParticipants(challengeId, sortBy = 'completedAt') {
        return await prisma.challengeParticipant.findMany({
            where: {
                challengeId: Number(challengeId),
                status: 'COMPLETED'
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                challenge: { select: { id: true, title: true, targetProgress: true } }
            },
            orderBy: sortBy === 'progress'
                ? { progress: 'desc' }
                : { completedAt: 'asc' }
        });
    },

    // =============================
    // Get Challenge Leaderboard
    // =============================
    async getChallengeLeaderboard(challengeId, { limit = 10, status = 'all' }) {
        const whereClause = { challengeId: Number(challengeId) };
        if (status !== 'all') whereClause.status = status.toUpperCase();

        return await prisma.challengeParticipant.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, name: true, email: true } },
                _count: { select: { progressLogs: true } }
            },
            orderBy: [
                { progress: 'desc' },
                { completedAt: 'asc' }
            ],
            take: Number(limit)
        });
    },

    // =============================
    // Get User All Progress
    // =============================
    async getUserAllProgress(userId) {
        return await prisma.challengeParticipant.findMany({
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
                _count: { select: { progressLogs: true } }
            },
            orderBy: { joinedAt: 'desc' }
        });
    },

    // =============================
    // Update Participant Status
    // =============================
    async updateParticipantStatus(id, status) {
        return await prisma.challengeParticipant.update({
            where: { id: Number(id) },
            data: { status },
            include: {
                user: { select: { id: true, name: true, email: true } },
                challenge: true
            }
        });
    },

    // =============================
    // Get Challenge Statistics
    // =============================
    async getChallengeStatistics(challengeId) {
        const [challenge, participants, completedCount, averageProgress] = await Promise.all([
            prisma.challenge.findUnique({ where: { id: Number(challengeId) } }),
            prisma.challengeParticipant.findMany({ where: { challengeId: Number(challengeId) } }),
            prisma.challengeParticipant.count({
                where: { challengeId: Number(challengeId), status: 'COMPLETED' }
            }),
            prisma.challengeParticipant.aggregate({
                where: { challengeId: Number(challengeId) },
                _avg: { progress: true }
            })
        ]);

        return { challenge, participants, completedCount, averageProgress };
    },

    // =============================
    // Get All Participants
    // =============================
    async getAllParticipants() {
        return await prisma.challengeParticipant.findMany({
            include: { user: true, challenge: true }
        });
    },

    // =============================
    // Get Participant By ID
    // =============================
    async getParticipantById(id) {
        return await prisma.challengeParticipant.findUnique({
            where: { id: Number(id) },
            include: { user: true, challenge: true }
        });
    },

    // =============================
    // Update Participant
    // =============================
    async updateParticipant(id, { challengeId, userId }) {
        return await prisma.challengeParticipant.update({
            where: { id: Number(id) },
            data: { challengeId, userId }
        });
    },

    // =============================
    // Delete Participant
    // =============================
    async deleteParticipant(id) {
        return await prisma.challengeParticipant.delete({
            where: { id: Number(id) }
        });
    },

    // =============================
    // Get Participants By Challenge
    // =============================
    async getParticipantsByChallenge(challengeId) {
        return await prisma.challengeParticipant.findMany({
            where: { challengeId: Number(challengeId) },
            include: { user: true }
        });
    },

    // =============================
    // Get Challenges By User
    // =============================
    async getChallengesByUser(userId) {
        return await prisma.challengeParticipant.findMany({
            where: { userId: Number(userId) },
            include: { challenge: true }
        });
    }
};

export default participantService;