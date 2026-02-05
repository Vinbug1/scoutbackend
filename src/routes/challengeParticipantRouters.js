import express from 'express';
const router = express.Router();
import controller from '../controllers/challengeParticipantController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Participant:
 *       type: object
 *       required:
 *         - challengeId
 *         - userId
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the participant
 *         challengeId:
 *           type: integer
 *           description: The ID of the challenge
 *         userId:
 *           type: integer
 *           description: The ID of the user
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the participant joined
 *       example:
 *         id: 1
 *         challengeId: 5
 *         userId: 10
 *         createdAt: 2024-01-01T00:00:00.000Z
 *     ParticipantInput:
 *       type: object
 *       required:
 *         - challengeId
 *         - userId
 *       properties:
 *         challengeId:
 *           type: integer
 *           description: The ID of the challenge
 *         userId:
 *           type: integer
 *           description: The ID of the user
 *       example:
 *         challengeId: 5
 *         userId: 10
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         error:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   name: Participants
 *   description: Challenge participant management API
 */

/**
 * @swagger
 * /api/participants:
 *   post:
 *     summary: Create a new participant (join a challenge)
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ParticipantInput'
 *     responses:
 *       201:
 *         description: Participant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Participant'
 *       400:
 *         description: User already joined this challenge
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', controller.createParticipant);

/**
 * @swagger
 * /api/participants:
 *   get:
 *     summary: Get all participants
 *     tags: [Participants]
 *     responses:
 *       200:
 *         description: List of all participants
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Participant'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', controller.getAllParticipants);

/**
 * @swagger
 * /api/participants/{id}:
 *   get:
 *     summary: Get participant by ID
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The participant ID
 *     responses:
 *       200:
 *         description: Participant details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Participant'
 *       404:
 *         description: Participant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', controller.getParticipantById);

/**
 * @swagger
 * /api/participants/{id}:
 *   put:
 *     summary: Update a participant
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The participant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ParticipantInput'
 *     responses:
 *       200:
 *         description: Participant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Participant'
 *       400:
 *         description: User already registered for this challenge
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', controller.updateParticipant);

/**
 * @swagger
 * /api/participants/{id}:
 *   delete:
 *     summary: Delete a participant (leave a challenge)
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The participant ID
 *     responses:
 *       200:
 *         description: Participant removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 participant:
 *                   $ref: '#/components/schemas/Participant'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', controller.deleteParticipant);

/**
 * @swagger
 * /api/participants/challenge/{challengeId}:
 *   get:
 *     summary: Get all participants in a specific challenge
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: challengeId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The challenge ID
 *     responses:
 *       200:
 *         description: List of participants in the challenge
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Participant'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/challenge/:challengeId', controller.getParticipantsByChallenge);

/**
 * @swagger
 * /api/participants/user/{userId}:
 *   get:
 *     summary: Get all challenges a user has joined
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: List of challenges the user joined
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Participant'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/user/:userId', controller.getChallengesByUser);

export default router;












// const express = require('express');
// const router = express.Router();
// const controller = require('../controllers/challengeParticipant.controller');

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Participant:
//  *       type: object
//  *       required:
//  *         - challengeId
//  *         - userId
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: The auto-generated id of the participant
//  *         challengeId:
//  *           type: integer
//  *           description: The ID of the challenge
//  *         userId:
//  *           type: integer
//  *           description: The ID of the user
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the participant joined
//  *       example:
//  *         id: 1
//  *         challengeId: 5
//  *         userId: 10
//  *         createdAt: 2024-01-01T00:00:00.000Z
//  *     ParticipantInput:
//  *       type: object
//  *       required:
//  *         - challengeId
//  *         - userId
//  *       properties:
//  *         challengeId:
//  *           type: integer
//  *           description: The ID of the challenge
//  *         userId:
//  *           type: integer
//  *           description: The ID of the user
//  *       example:
//  *         challengeId: 5
//  *         userId: 10
//  *     Error:
//  *       type: object
//  *       properties:
//  *         message:
//  *           type: string
//  *         error:
//  *           type: string
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: Participants
//  *   description: Challenge participant management API
//  */

// /**
//  * @swagger
//  * /api/participants:
//  *   post:
//  *     summary: Create a new participant (join a challenge)
//  *     tags: [Participants]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ParticipantInput'
//  *     responses:
//  *       201:
//  *         description: Participant created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Participant'
//  *       400:
//  *         description: User already joined this challenge
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/', controller.createParticipant);

// /**
//  * @swagger
//  * /api/participants:
//  *   get:
//  *     summary: Get all participants
//  *     tags: [Participants]
//  *     responses:
//  *       200:
//  *         description: List of all participants
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Participant'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', controller.getAllParticipants);

// /**
//  * @swagger
//  * /api/participants/{id}:
//  *   get:
//  *     summary: Get participant by ID
//  *     tags: [Participants]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The participant ID
//  *     responses:
//  *       200:
//  *         description: Participant details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Participant'
//  *       404:
//  *         description: Participant not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:id', controller.getParticipantById);

// /**
//  * @swagger
//  * /api/participants/{id}:
//  *   put:
//  *     summary: Update a participant
//  *     tags: [Participants]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The participant ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ParticipantInput'
//  *     responses:
//  *       200:
//  *         description: Participant updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Participant'
//  *       400:
//  *         description: User already registered for this challenge
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put('/:id', controller.updateParticipant);

// /**
//  * @swagger
//  * /api/participants/{id}:
//  *   delete:
//  *     summary: Delete a participant (leave a challenge)
//  *     tags: [Participants]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The participant ID
//  *     responses:
//  *       200:
//  *         description: Participant removed successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                 participant:
//  *                   $ref: '#/components/schemas/Participant'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/:id', controller.deleteParticipant);

// /**
//  * @swagger
//  * /api/participants/challenge/{challengeId}:
//  *   get:
//  *     summary: Get all participants in a specific challenge
//  *     tags: [Participants]
//  *     parameters:
//  *       - in: path
//  *         name: challengeId
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The challenge ID
//  *     responses:
//  *       200:
//  *         description: List of participants in the challenge
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Participant'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/challenge/:challengeId', controller.getParticipantsByChallenge);

// /**
//  * @swagger
//  * /api/participants/user/{userId}:
//  *   get:
//  *     summary: Get all challenges a user has joined
//  *     tags: [Participants]
//  *     parameters:
//  *       - in: path
//  *         name: userId
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The user ID
//  *     responses:
//  *       200:
//  *         description: List of challenges the user joined
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Participant'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/user/:userId', controller.getChallengesByUser);

// module.exports = router;