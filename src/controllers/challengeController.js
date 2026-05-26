import ChallengeService from '../services/challengeService.js';
import { uploadMediaToGCS } from '../middleware/upload.js';
import fs from 'fs';

const ChallengeController = {

    // =============================
    // Create a Challenge
    // =============================
    async createChallenge(req, res) {
        const videoFile = req.files?.video?.[0];

        try {
            const { title, description, startAt, endAt } = req.body;

            if (!videoFile) {
                return res.status(400).json({ error: 'A video file is required.' });
            }

            // Upload video to GCS → get HLS master URL + thumbnail
            const { url: videoUrl, thumbnailUrl } = await uploadMediaToGCS(
                videoFile,
                'challenges'
            );

            const challenge = await ChallengeService.createChallenge({
                title,
                description,
                startAt,
                endAt,
                videoUrl,
                thumbnailUrl,
                creatorId: req.user.userId,
            });

            res.status(201).json({
                message: 'Challenge created successfully',
                data: challenge,
            });

        } catch (error) {
            console.error('Create Challenge Error:', error);
            res.status(500).json({ error: 'Failed to create challenge' });
        } finally {
            // Always clean up the multer disk temp file
            if (videoFile?.path) {
                try { fs.unlinkSync(videoFile.path); } catch { /* ignore */ }
            }
        }
    },

    // =============================
    // Get All Challenges
    // =============================
    async getAllChallenges(req, res) {
        try {
            const challenges = await ChallengeService.getAllChallenges();
            res.json(challenges);
        } catch (error) {
            console.error('Get Challenges Error:', error);
            res.status(500).json({ error: 'Failed to fetch challenges' });
        }
    },

    // =============================
    // Get Challenge By ID
    // =============================
    async getChallengeById(req, res) {
        try {
            const { id } = req.params;
            const challenge = await ChallengeService.getChallengeById(id);

            if (!challenge) {
                return res.status(404).json({ error: 'Challenge not found' });
            }

            res.json(challenge);
        } catch (error) {
            console.error('Get Challenge Error:', error);
            res.status(500).json({ error: 'Failed to fetch challenge' });
        }
    },

    // =============================
    // Update Challenge
    // =============================
    async updateChallenge(req, res) {
        const videoFile = req.files?.video?.[0];

        try {
            const { id } = req.params;
            const { title, description, startAt, endAt } = req.body;

            const existingChallenge = await ChallengeService.getChallengeById(id);
            if (!existingChallenge) {
                return res.status(404).json({ error: 'Challenge not found' });
            }

            if (existingChallenge.creatorId !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized to update this challenge' });
            }

            // Only re-upload if a new video was provided
            let videoUrl      = undefined;
            let thumbnailUrl  = undefined;

            if (videoFile) {
                const result  = await uploadMediaToGCS(videoFile, 'challenges');
                videoUrl      = result.url;
                thumbnailUrl  = result.thumbnailUrl;
            }

            const challenge = await ChallengeService.updateChallenge(id, {
                title,
                description,
                startAt,
                endAt,
                videoUrl,       // undefined = service ignores it (no overwrite)
                thumbnailUrl,
            });

            res.json({
                message: 'Challenge updated successfully',
                data: challenge,
            });

        } catch (error) {
            console.error('Update Challenge Error:', error);
            res.status(500).json({ error: 'Failed to update challenge' });
        } finally {
            if (videoFile?.path) {
                try { fs.unlinkSync(videoFile.path); } catch { /* ignore */ }
            }
        }
    },

    // =============================
    // Delete Challenge
    // =============================
    async deleteChallenge(req, res) {
        try {
            const { id } = req.params;
            await ChallengeService.deleteChallenge(id);
            res.json({ message: 'Challenge deleted successfully' });
        } catch (error) {
            console.error('Delete Challenge Error:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Challenge not found' });
            }
            res.status(500).json({ error: 'Failed to delete challenge' });
        }
    }
};

export default ChallengeController;












// import ChallengeService from '../services/challengeService.js';

// const ChallengeController = {

//     // =============================
//     // Create a Challenge
//     // =============================
//     async createChallenge(req, res) {
//         try {
//             const { title, description, startAt, endAt } = req.body;

//             const challenge = await ChallengeService.createChallenge({
//                 title,
//                 description,
//                 startAt,
//                 endAt,
//                 creatorId: req.user.userId,  // ✅ Use authenticated user's ID
//             });

//             res.status(201).json({
//                 message: "Challenge created successfully",
//                 data: challenge
//             });
//         } catch (error) {
//             console.error("Create Challenge Error:", error);
//             res.status(500).json({ error: "Failed to create challenge" });
//         }
//     },

//     // =============================
//     // Get All Challenges
//     // =============================
//     async getAllChallenges(req, res) {
//         try {
//             const challenges = await ChallengeService.getAllChallenges();
//             res.json(challenges);
//         } catch (error) {
//             console.error("Get Challenges Error:", error);
//             res.status(500).json({ error: "Failed to fetch challenges" });
//         }
//     },

//     // =============================
//     // Get Challenge By ID
//     // =============================
//     async getChallengeById(req, res) {
//         try {
//             const { id } = req.params;

//             const challenge = await ChallengeService.getChallengeById(id);

//             if (!challenge) {
//                 return res.status(404).json({ error: "Challenge not found" });
//             }

//             res.json(challenge);
//         } catch (error) {
//             console.error("Get Challenge Error:", error);
//             res.status(500).json({ error: "Failed to fetch challenge" });
//         }
//     },

//     // =============================
//     // Update Challenge
//     // =============================
//     async updateChallenge(req, res) {
//         try {
//             const { id } = req.params;
//             const { title, description, startAt, endAt } = req.body;

//             // Check if challenge exists
//             const existingChallenge = await ChallengeService.getChallengeById(id);

//             if (!existingChallenge) {
//                 return res.status(404).json({ error: "Challenge not found" });
//             }

//             // Check authorization (creator or admin)
//             if (existingChallenge.creatorId !== req.user.userId && req.user.role !== 'admin') {
//                 return res.status(403).json({ error: "Not authorized to update this challenge" });
//             }

//             const challenge = await ChallengeService.updateChallenge(id, {
//                 title,
//                 description,
//                 startAt,
//                 endAt,
//             });

//             res.json({
//                 message: "Challenge updated successfully",
//                 data: challenge
//             });
//         } catch (error) {
//             console.error("Update Challenge Error:", error);
//             res.status(500).json({ error: "Failed to update challenge" });
//         }
//     },

//     // =============================
//     // Delete Challenge
//     // =============================
//     async deleteChallenge(req, res) {
//         try {
//             const { id } = req.params;

//             await ChallengeService.deleteChallenge(id);

//             res.json({ message: "Challenge deleted successfully" });
//         } catch (error) {
//             console.error("Delete Challenge Error:", error);

//             if (error.code === "P2025") {
//                 return res.status(404).json({ error: "Challenge not found" });
//             }

//             res.status(500).json({ error: "Failed to delete challenge" });
//         }
//     }
// };

// export default ChallengeController;









// import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// // const prisma = new PrismaClient();

// const ChallengeController = {

//     // =============================
//     // Create a Challenge
//     // =============================
//     async createChallenge(req, res) {
//         try {
//             const { title, description, startAt, endAt } = req.body;
            
//             // Get creator from authenticated user
//             const challenge = await prisma.challenge.create({
//                 data: {
//                     title,
//                     description,
//                     startAt: startAt ? new Date(startAt) : null,
//                     endAt: endAt ? new Date(endAt) : null,
//                     creatorId: req.user.userId,  // ✅ Use authenticated user's ID
//                 }
//             });
    
//             res.status(201).json({
//                 message: "Challenge created successfully",
//                 data: challenge
//             });
//         } catch (error) {
//             console.error("Create Challenge Error:", error);
//             res.status(500).json({ error: "Failed to create challenge" });
//         }
//     },

//     // =============================
//     // Get All Challenges
//     // =============================
//     async getAllChallenges(req, res) {
//         try {
//             const challenges = await prisma.challenge.findMany({
//                 include: {
//                     creator: true,
//                     participants: true
//                 }
//             });

//             res.json(challenges);

//         } catch (error) {
//             console.error("Get Challenges Error:", error);
//             res.status(500).json({ error: "Failed to fetch challenges" });
//         }
//     },

//     // =============================
//     // Get Challenge By ID
//     // =============================
//     async getChallengeById(req, res) {
//         try {
//             const { id } = req.params;

//             const challenge = await prisma.challenge.findUnique({
//                 where: { id: Number(id) },
//                 include: {
//                     creator: true,
//                     participants: true
//                 }
//             });

//             if (!challenge) {
//                 return res.status(404).json({ error: "Challenge not found" });
//             }

//             res.json(challenge);

//         } catch (error) {
//             console.error("Get Challenge Error:", error);
//             res.status(500).json({ error: "Failed to fetch challenge" });
//         }
//     },

//     // =============================
//     // Update Challenge
//     // =============================
//     async updateChallenge(req, res) {
//         try {
//             const { id } = req.params;
//             const { title, description, startAt, endAt } = req.body;

//             // First, check if challenge exists and if user is the creator
//             const existingChallenge = await prisma.challenge.findUnique({
//                 where: { id: Number(id) }
//             });

//             if (!existingChallenge) {
//                 return res.status(404).json({ error: "Challenge not found" });
//             }

//             // Check authorization (creator or admin)
//             if (existingChallenge.creatorId !== req.user.userId && req.user.role !== 'admin') {
//                 return res.status(403).json({ error: "Not authorized to update this challenge" });
//             }

//             const challenge = await prisma.challenge.update({
//                 where: { id: Number(id) },
//                 data: {
//                     title,
//                     description,
//                     startAt: startAt ? new Date(startAt) : null,
//                     endAt: endAt ? new Date(endAt) : null,
//                 }
//             });

//             res.json({
//                 message: "Challenge updated successfully",
//                 data: challenge
//             });

//         } catch (error) {
//             console.error("Update Challenge Error:", error);
//             res.status(500).json({ error: "Failed to update challenge" });
//         }
//     },

//     // =============================
//     // Delete Challenge
//     // =============================
//     async deleteChallenge(req, res) {
//         try {
//             const { id } = req.params;

//             await prisma.challenge.delete({
//                 where: { id: Number(id) }
//             });

//             res.json({ message: "Challenge deleted successfully" });

//         } catch (error) {
//             console.error("Delete Challenge Error:", error);

//             if (error.code === "P2025") {
//                 return res.status(404).json({ error: "Challenge not found" });
//             }

//             res.status(500).json({ error: "Failed to delete challenge" });
//         }
//     }
// };

// export default ChallengeController;