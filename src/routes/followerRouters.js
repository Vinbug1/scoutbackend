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












// import express from 'express';
// const router = express.Router();
// import followerController from '../controllers/followerController.js';
// import { verifyToken } from '../middleware/auth.js'; // adjust path if this lives elsewhere

// /**
//  * Mount this at '/users' so the paths resolve exactly as the plan specifies:
//  *   app.use('/users', followerRouter);
//  *
//  * -> POST   /users/:id/follow
//  * -> DELETE /users/:id/follow
//  * -> GET    /users/:id/followers
//  * -> GET    /users/:id/following
//  *
//  * If you already have a users router, these four routes can just be added
//  * to it directly instead of mounting a separate file.
//  *
//  * Auth: POST/DELETE /follow require a logged-in user (verifyToken) since
//  * we need to know who's doing the following. GET followers/following are
//  * left public here — followerController already handles a missing
//  * req.user gracefully (viewerActions.isFollowing just won't compute for
//  * an anonymous viewer). Add verifyToken to those two as well if you want
//  * the lists gated behind login too.
//  */

// /**
//  * @swagger
//  * /users/{id}/follow:
//  *   post:
//  *     summary: Follow a user
//  *     tags: [Followers]
//  *     description: Idempotent — returns 200 with following:true whether or not the relationship already existed.
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The ID of the user to follow
//  *     responses:
//  *       200:
//  *         description: Follow relationship is now active
//  *       400:
//  *         description: Cannot follow yourself
//  *       500:
//  *         description: Server error
//  */
// router.post('/:id/follow', verifyToken, followerController.follow);

// /**
//  * @swagger
//  * /users/{id}/follow:
//  *   delete:
//  *     summary: Unfollow a user
//  *     tags: [Followers]
//  *     description: Idempotent — returns 200 with following:false whether or not the relationship existed.
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The ID of the user to unfollow
//  *     responses:
//  *       200:
//  *         description: Follow relationship is now inactive
//  *       500:
//  *         description: Server error
//  */
// router.delete('/:id/follow', verifyToken, followerController.unfollow);

// /**
//  * @swagger
//  * /users/{id}/followers:
//  *   get:
//  *     summary: List a user's followers
//  *     tags: [Followers]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: Paginated list of followers, each with viewerActions.isFollowing
//  */
// router.get('/:id/followers', followerController.getFollowers);

// /**
//  * @swagger
//  * /users/{id}/following:
//  *   get:
//  *     summary: List who a user follows
//  *     tags: [Followers]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: Paginated list of followed users, each with viewerActions.isFollowing
//  */
// router.get('/:id/following', followerController.getFollowing);

// export default router;



















// import express from 'express';
// const router = express.Router();
// import followerController from '../controllers/followerController.js';

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     User:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: The user ID
//  *         username:
//  *           type: string
//  *           description: The username
//  *         email:
//  *           type: string
//  *           description: The user email
//  *     
//  *     Follower:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: The follower relationship ID
//  *         followerId:
//  *           type: integer
//  *           description: The ID of the user who is following
//  *         followedId:
//  *           type: integer
//  *           description: The ID of the user being followed
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Timestamp when the relationship was created
//  *         follower:
//  *           $ref: '#/components/schemas/User'
//  *         followed:
//  *           $ref: '#/components/schemas/User'
//  *     
//  *     FollowerInput:
//  *       type: object
//  *       required:
//  *         - followerId
//  *         - followedId
//  *       properties:
//  *         followerId:
//  *           type: integer
//  *           description: The ID of the user who will follow
//  *         followedId:
//  *           type: integer
//  *           description: The ID of the user to be followed
//  *     
//  *     FollowerUpdateInput:
//  *       type: object
//  *       required:
//  *         - followedId
//  *       properties:
//  *         followedId:
//  *           type: integer
//  *           description: The new ID of the user to be followed
//  *     
//  *     Error:
//  *       type: object
//  *       properties:
//  *         error:
//  *           type: string
//  *           description: Error message
//  */

// /**
//  * @swagger
//  * /api/followers:
//  *   get:
//  *     summary: Get all follower relationships
//  *     tags: [Followers]
//  *     description: Retrieve a list of all follower relationships including follower and followed user details
//  *     responses:
//  *       200:
//  *         description: A list of follower relationships
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Follower'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', followerController.getAll);

// /**
//  * @swagger
//  * /api/followers/{id}:
//  *   get:
//  *     summary: Get a follower relationship by ID
//  *     tags: [Followers]
//  *     description: Retrieve a specific follower relationship by its ID
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The follower relationship ID
//  *     responses:
//  *       200:
//  *         description: The follower relationship details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Follower'
//  *       404:
//  *         description: Follower relationship not found
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
// router.get('/:id', followerController.getById);

// /**
//  * @swagger
//  * /api/followers:
//  *   post:
//  *     summary: Create a new follower relationship
//  *     tags: [Followers]
//  *     description: Create a new follow relationship between two users
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/FollowerInput'
//  *           example:
//  *             followerId: 1
//  *             followedId: 2
//  *     responses:
//  *       201:
//  *         description: Follower relationship created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Follower'
//  *       400:
//  *         description: Bad request (user cannot follow themselves or relationship already exists)
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
// router.post('/', followerController.create);

// /**
//  * @swagger
//  * /api/followers/{id}:
//  *   put:
//  *     summary: Update a follower relationship
//  *     tags: [Followers]
//  *     description: Update the followed user in an existing follower relationship
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The follower relationship ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/FollowerUpdateInput'
//  *           example:
//  *             followedId: 3
//  *     responses:
//  *       200:
//  *         description: Follower relationship updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Follower'
//  *       400:
//  *         description: Bad request (relationship already exists)
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Follower relationship not found
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
// router.put('/:id', followerController.update);

// /**
//  * @swagger
//  * /api/followers/{id}:
//  *   delete:
//  *     summary: Delete a follower relationship
//  *     tags: [Followers]
//  *     description: Remove a follower relationship by its ID
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The follower relationship ID
//  *     responses:
//  *       200:
//  *         description: Follower relationship deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: Follower relationship deleted successfully
//  *       404:
//  *         description: Follower relationship not found
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
// router.delete('/:id', followerController.delete);

// export default router;