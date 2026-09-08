import express from 'express';
import followerController from '../controllers/followerController.js';
import { verifyToken as authenticate } from '../middleware/auth.js';

const router = express.Router();

// Mounted at /api/users in app.js — these paths join with userRouters.js
// to match the follow-feature plan exactly (POST /users/:id/follow, etc.).
// This file used to be mounted at /api/followers and pointed at
// followerController.getAll/getById/create/update/delete, none of which
// exist on the controller anymore — every request to it 500'd. Rebuilt
// against the current follow/unfollow controller.

/**
 * @swagger
 * tags:
 *   - name: Followers
 *     description: Follow / unfollow users and browse follower lists
 *
 * components:
 *   schemas:
 *     FollowUser:
 *       type: object
 *       description: >
 *         The shape returned for each row in a followers/following list —
 *         see followerService.js's formatUserSummary. avatarUrl and
 *         position come from Profile for players, or ScoutProfile
 *         (avatarUrl only) for scouts.
 *       properties:
 *         id:        { type: integer }
 *         fullname:  { type: string }
 *         role:      { type: string, enum: [PLAYER, SCOUT, ADMIN] }
 *         avatarUrl: { type: string, nullable: true, format: uri }
 *         position:  { type: string, nullable: true, description: Player position; always null for scouts }
 *         viewerActions:
 *           type: object
 *           properties:
 *             isFollowing:
 *               type: boolean
 *               description: Whether the authenticated caller follows this user.
 *       example:
 *         id: 42
 *         fullname: Marcus Adeyemi
 *         role: PLAYER
 *         avatarUrl: https://cdn.thescouterpro.com/avatars/42.jpg
 *         position: Midfielder
 *         viewerActions: { isFollowing: false }
 *
 *     FollowToggleResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         data:
 *           type: object
 *           properties:
 *             following:      { type: boolean, description: The relationship's state after this call }
 *             followersCount: { type: integer, description: The followed user's total follower count after this call }
 *       example:
 *         success: true
 *         data: { following: true, followersCount: 1284 }
 *
 *     FollowerListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/FollowUser' }
 *         pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *
 *     FollowErrorResponse:
 *       type: object
 *       properties:
 *         error: { type: string }
 *       example:
 *         error: Invalid user id
 */

/**
 * @swagger
 * /users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     description: >
 *       Idempotent — returns 200 whether or not the relationship already
 *       existed. Following yourself returns 400.
 *     tags: [Followers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: The user ID to follow
 *     responses:
 *       200:
 *         description: Now following
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowToggleResponse' }
 *       400:
 *         description: Invalid user id, or attempted to follow yourself
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 *       404:
 *         description: User to follow not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 */
router.post('/:id/follow', authenticate, followerController.follow);

/**
 * @swagger
 * /users/{id}/follow:
 *   delete:
 *     summary: Unfollow a user
 *     description: Idempotent — returns 200 even if the relationship never existed.
 *     tags: [Followers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: The user ID to unfollow
 *     responses:
 *       200:
 *         description: No longer following
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowToggleResponse' }
 *       400:
 *         description: Invalid user id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 */
router.delete('/:id/follow', authenticate, followerController.unfollow);

/**
 * @swagger
 * /users/{id}/followers:
 *   get:
 *     summary: List a user's followers
 *     description: >
 *       Each row includes `viewerActions.isFollowing` so the client can
 *       render Follow buttons without an extra request per row.
 *     tags: [Followers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of followers, most recent follow first
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowerListResponse' }
 *       400:
 *         description: Invalid user id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 */
router.get('/:id/followers', authenticate, followerController.getFollowers);

/**
 * @swagger
 * /users/{id}/following:
 *   get:
 *     summary: List who a user follows
 *     tags: [Followers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of who the user follows, most recent follow first
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowerListResponse' }
 *       400:
 *         description: Invalid user id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowErrorResponse' }
 */
router.get('/:id/following', authenticate, followerController.getFollowing);

export default router;


