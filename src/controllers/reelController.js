// src/controllers/reelController.js

import fs from 'fs';
import {
  uploadReel,
  createPendingReel,
  updateReelStatus,
  getReelsByUser,
  getReelById,
  getReelsByCategory,
  recordReelView,
} from '../services/reelService.js';

const reelController = {

  // =========================================================
  // POST /api/reels/upload
  // =========================================================
  async handleReelUpload(req, res) {
    const multerFile = req.files?.video?.[0];

    try {

      // ─────────────────────────────────────────────
      // Auth check
      // ─────────────────────────────────────────────
      if (req.user.role !== 'PLAYER') {
        return res.status(403).json({
          success: false,
          message: 'Only players can upload reels.',
        });
      }

      if (!multerFile) {
        return res.status(400).json({
          success: false,
          message: 'No video file provided.',
        });
      }

      // ─────────────────────────────────────────────
      // Validate body
      // ─────────────────────────────────────────────
      const {
        title,
        description,
        published,
        categoryId,
      } = req.body;

      const titleStr = String(title ?? '').trim();

      if (!titleStr) {
        return res.status(400).json({
          success: false,
          message: 'Reel title is required.',
        });
      }

      const parsedCategoryId = Number(categoryId);

      if (
        !parsedCategoryId ||
        Number.isNaN(parsedCategoryId) ||
        parsedCategoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'A valid categoryId is required.',
        });
      }

      const isPublished =
        String(published)
          .toLowerCase()
          .trim() === 'true';

      // ─────────────────────────────────────────────
      // Create pending reel
      // ─────────────────────────────────────────────
      let pendingReel = null;

      try {

        pendingReel =
          await createPendingReel({
            title: titleStr,
            description:
              String(description ?? ''),
            published: isPublished,
            categoryId:
              parsedCategoryId,
            playerId:
              req.user.userId,
          });

      } catch (dbErr) {

        console.error(
          '❌ createPendingReel:',
          dbErr
        );

        if (dbErr.code === 'P2003') {
          return res.status(400).json({
            success: false,
            message:
              'Category not found.',
          });
        }

        return res.status(
          dbErr.statusCode || 500
        ).json({
          success: false,
          message:
            'Failed to create reel.',
        });

      }

      // ─────────────────────────────────────────────
      // Respond immediately
      // ─────────────────────────────────────────────
      res.status(202).json({
        success: true,
        message:
          'Reel received. Processing in background.',
        data: {
          id: pendingReel.id,
          title: titleStr,
          status: 'processing',
        },
      });

      // ─────────────────────────────────────────────
      // Background upload
      // ─────────────────────────────────────────────
      (async () => {

        try {

          await uploadReel(
            multerFile,
            {
              reelId:
                pendingReel.id,
              title:
                titleStr,
              description:
                String(description ?? ''),
              published:
                isPublished,
              categoryId:
                parsedCategoryId,
            },
            req.user.userId
          );

          console.log(
            `✅ Reel ${pendingReel.id} ready`
          );

        } catch (err) {

          console.error(
            `❌ Upload failed [${pendingReel.id}]`,
            err
          );

          await updateReelStatus(
            pendingReel.id,
            {
              status: 'failed',
              videoUrl: '',
              thumbnailUrl: null,
              durationSec: null,
            }
          ).catch(console.error);

        } finally {

          if (multerFile?.path) {
            await fs.promises
              .unlink(multerFile.path)
              .catch(() => {});
          }

        }

      })();

    } catch (err) {

      console.error(
        '❌ handleReelUpload:',
        err
      );

      if (multerFile?.path) {
        await fs.promises
          .unlink(multerFile.path)
          .catch(() => {});
      }

      if (!res.headersSent) {
        return res.status(
          err.statusCode || 500
        ).json({
          success: false,
          message:
            err.message ||
            'Unexpected error',
        });
      }

    }
  },

  // =========================================================
  // GET /api/users/:userId/reels
  // =========================================================
  async handleGetUserReels(req, res) {

    try {

      const playerId =
        Number(req.params.userId);

      const categoryId =
        req.query.categoryId
          ? Number(
              req.query.categoryId
            )
          : null;

      const viewerId =
        req.user?.userId ?? null;

      if (
        Number.isNaN(playerId) ||
        playerId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid user ID.',
        });
      }

      if (
        req.query.categoryId &&
        (
          Number.isNaN(categoryId) ||
          categoryId <= 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid category ID.',
        });
      }

      const reels =
        await getReelsByUser(
          playerId,
          categoryId,
          viewerId
        );

      return res.status(200).json({
        success: true,
        data: reels,
      });

    } catch (err) {

      console.error(
        '❌ handleGetUserReels:',
        err
      );

      return res.status(
        err.statusCode || 500
      ).json({
        success: false,
        message:
          err.message,
      });

    }

  },

  // =========================================================
  // GET /api/reels?categoryId=7
  // =========================================================
  async handleGetReelsByCategory( req,  res  ) {

    try {

      const categoryId =
        Number(
          req.query.categoryId
        );

      const viewerId =
        req.user?.userId ??
        null;

      if (
        Number.isNaN(
          categoryId
        ) ||
        categoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Valid categoryId required.',
        });
      }

      const reels =
        await getReelsByCategory(
          categoryId,
          viewerId
        );

      return res.status(200).json({
        success: true,
        data: reels,
      });

    } catch (err) {

      console.error(
        '❌ handleGetReelsByCategory:',
        err
      );

      return res.status(
        err.statusCode || 500
      ).json({
        success: false,
        message:
          err.message,
      });

    }

  },

  // =========================================================
  // GET /api/reels/:reelId
  // =========================================================
  async handleGetReel( req, res ) {

    try {

      const reelId =
        Number(
          req.params.reelId
        );

      if (
        Number.isNaN(
          reelId
        ) ||
        reelId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid reel ID.',
        });
      }

      const viewerId =
        req.user?.userId ??
        null;

      const rawIp =
        req.headers[
          'x-forwarded-for'
        ]
          ?.split(',')[0]
          ?.trim() ||
        req.ip ||
        '';

      const ipHash =
        rawIp
          ? Buffer
              .from(rawIp)
              .toString(
                'base64'
              )
              .slice(0, 32)
          : null;

      const reel =
        await getReelById(
          reelId,
          viewerId,
          ipHash
        );

      return res.status(200).json({
        success: true,
        data: reel,
      });

    } catch (err) {

      if (
        err.code ===
        'P2025'
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Reel not found.',
        });
      }

      console.error(
        '❌ handleGetReel:',
        err
      );

      return res.status(
        err.statusCode || 500
      ).json({
        success: false,
        message:
          err.message,
      });

    }

  },

  // =========================================================
// POST /api/reels/:reelId/view
// =========================================================
async handleRecordReelView(req, res) {
  try {
    const reelId = Number(req.params.reelId);

    if (Number.isNaN(reelId) || reelId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID.',
      });
    }

    const viewerId = req.user?.userId ?? null;

    const rawIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      '';

    const ipHash = rawIp
      ? Buffer.from(rawIp).toString('base64').slice(0, 32)
      : null;

    const result = await recordReelView(reelId, viewerId, ipHash);

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (err) {
    console.error('❌ handleRecordReelView:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to record view.',
    });
  }
},

};

export default reelController;



