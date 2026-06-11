import fs from 'fs';
import {
  uploadReel,
  createPendingReel,
  updateReelStatus,
  getReelsByUser,
  getReelById,
  getReelsByCategory,
} from '../services/reelService.js';

// =========================================================
// POST /api/reels/upload
// =========================================================
export const handleReelUpload = async (req, res) => {
  const multerFile = req.files?.video?.[0];

  try {
    // ── Auth & role check ──────────────────────────────────
    if (req.user.role !== 'PLAYER') {
      return res.status(403).json({ success: false, message: 'Only players can upload reels.' });
    }

    if (!multerFile) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    // ── Validate body ──────────────────────────────────────
    const { title, description, published, categoryId } = req.body;
    const titleStr = String(title ?? '').trim();

    if (!titleStr) {
      return res.status(400).json({ success: false, message: 'Reel title is required.' });
    }

    const parsedCategoryId = parseInt(categoryId, 10);
    if (!categoryId || isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid categoryId is required for reels.' });
    }

    // ── 1. Save pending record ─────────────────────────────
    let pendingReel;
    try {
      pendingReel = await createPendingReel({
        title:       titleStr,
        description: String(description ?? ''),
        published:   published === 'true',
        categoryId:  parsedCategoryId,
        playerId:    req.user.userId,
      });
    } catch (dbErr) {
      console.error('❌ createPendingReel failed:', dbErr);
      if (dbErr.code === 'P2003') {
        return res.status(400).json({ success: false, message: 'Category not found.' });
      }
      return res.status(500).json({ success: false, message: 'Failed to create reel record.' });
    }

    // ── 2. Respond immediately (202) ───────────────────────
    res.status(202).json({
      success: true,
      message: 'Reel received. Processing in background.',
      data:    { id: pendingReel.id, status: 'processing', title: titleStr },
    });

    // ── 3. Heavy work AFTER response is flushed ────────────
    uploadReel(
      multerFile,
      {
        title:       titleStr,
        description: String(description ?? ''),
        published:   published === 'true',
        categoryId:  parsedCategoryId,
        reelId:      pendingReel.id,
      },
      req.user.userId,
    )
      .then(() => console.log(`✅ Reel ${pendingReel.id} ready`))
      .catch(async (err) => {
        console.error(`❌ Background reel processing failed [reel ${pendingReel.id}]:`, err);
        await updateReelStatus(pendingReel.id, {
          status:       'failed',
          videoUrl:     '',
          thumbnailUrl: null,
          durationSec:  null,
        }).catch((e) => console.error('❌ updateReelStatus failed:', e));
      })
      .finally(() => {
        if (multerFile?.path) {
          try { fs.unlinkSync(multerFile.path); } catch { /* ignore */ }
        }
      });

  } catch (err) {
    if (multerFile?.path) {
      try { fs.unlinkSync(multerFile.path); } catch { /* ignore */ }
    }
    console.error('❌ handleReelUpload:', err);

    if (!res.headersSent) {
      return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
    }
  }
};

// =========================================================
// GET /api/users/:userId/reels
// GET /api/users/:userId/reels?categoryId=7
// =========================================================
export const handleGetUserReels = async (req, res) => {
  try {
    const playerId   = parseInt(req.params.userId, 10);
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;

    if (isNaN(playerId) || playerId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    if (req.query.categoryId && (isNaN(categoryId) || categoryId <= 0)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID.' });
    }

    const reels = await getReelsByUser(playerId, categoryId);
    return res.status(200).json({ success: true, data: reels });
  } catch (err) {
    console.error('❌ handleGetUserReels:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/reels?categoryId=7
// =========================================================
export const handleGetReelsByCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.query.categoryId, 10);

    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid categoryId query param is required.' });
    }

    const reels = await getReelsByCategory(categoryId);

    // ✅ Always return 200 — empty array is a valid response, not an error
    return res.status(200).json({ success: true, data: reels });
  } catch (err) {
    console.error('❌ handleGetReelsByCategory:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/reels/:reelId
// =========================================================
export const handleGetReel = async (req, res) => {
  try {
    const reelId = parseInt(req.params.reelId, 10);
    if (isNaN(reelId) || reelId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID.' });
    }

    const viewerId = req.user?.userId ?? null;
    const rawIp    = req.ip || req.headers['x-forwarded-for'] || '';
    const ipHash   = rawIp
      ? Buffer.from(rawIp).toString('base64').slice(0, 32)
      : null;

    const reel = await getReelById(reelId, viewerId, ipHash);
    return res.status(200).json({ success: true, data: reel });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Reel not found.' });
    }
    console.error('❌ handleGetReel:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


