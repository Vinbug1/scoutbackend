import prisma from '../lib/prisma.js';

const ChallengeService = {

    async createChallenge({ title, description, startAt, endAt, videoUrl, thumbnailUrl, creatorId }) {
        return await prisma.challenge.create({
            data: {
                title,
                description,
                videoUrl,
                thumbnailUrl,
                startAt:   startAt ? new Date(startAt) : null,
                endAt:     endAt   ? new Date(endAt)   : null,
                creatorId,
            }
        });
    },

    async getAllChallenges() {
        return await prisma.challenge.findMany({
            include: { creator: true, participants: true }
        });
    },

    async getChallengeById(id) {
        return await prisma.challenge.findUnique({
            where: { id: Number(id) },
            include: { creator: true, participants: true }
        });
    },

    // videoUrl/thumbnailUrl are optional — only overwrite if a new video was uploaded
    async updateChallenge(id, { title, description, startAt, endAt, videoUrl, thumbnailUrl }) {
        return await prisma.challenge.update({
            where: { id: Number(id) },
            data: {
                title,
                description,
                startAt:     startAt ? new Date(startAt) : null,
                endAt:       endAt   ? new Date(endAt)   : null,
                // Only include video fields if they were actually updated
                ...(videoUrl     && { videoUrl }),
                ...(thumbnailUrl && { thumbnailUrl }),
            }
        });
    },

    async deleteChallenge(id) {
        return await prisma.challenge.delete({
            where: { id: Number(id) }
        });
    }
};

export default ChallengeService;





