import {
  uploadVideo, createPendingVideo, updateVideoStatus,uploadAvatar,getVideosByUser,getMyProfileWithVideos,getVideoById,
} from '../services/videoService.js';

// =========================================================
// POST /api/videos/upload
// ─ PLAYER:  playerId comes from JWT (req.user.userId)
// ─ SCOUT:   playerId must be sent in req.body.playerId
// =========================================================


import fs from 'fs';


export const handleVideoUpload = async (req, res) => {
  const multerFile = req.files?.video?.[0];

  try {
    if (req.user.role !== 'PLAYER') {
      return res.status(403).json({ success: false, message: 'Only players can upload videos.' });
    }

    if (!multerFile) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    const { title, description, published } = req.body;
    const titleStr = String(title ?? '').trim();

    if (!titleStr) {
      return res.status(400).json({ success: false, message: 'Video title is required.' });
    }

    // ✅ 1. Save a pending record immediately
    const pendingVideo = await createPendingVideo({
      title:       titleStr,
      description: String(description ?? ''),
      published:   published === 'true',
      playerId:    req.user.userId,
    });

    // ✅ 2. Respond straight away — frontend gets an ID to poll
    res.status(202).json({
      success: true,
      message: 'Video received. Processing in background.',
      data:    { id: pendingVideo.id, status: 'processing', title: titleStr },
    });

    // ✅ 3. Do the heavy work after the response is sent
    uploadVideo(
      multerFile,
      {
        title:       titleStr,
        description: String(description ?? ''),
        published:   published === 'true',
        videoId:     pendingVideo.id,   // update this record, don't create a new one
      },
      req.user.userId,
    )
      .then(() => console.log(`✅ Video ${pendingVideo.id} ready`))
      .catch(async (err) => {
        console.error(`❌ Background processing failed [video ${pendingVideo.id}]:`, err);
        // Mark as failed so the frontend doesn't poll forever
        await updateVideoStatus(pendingVideo.id, {
          status:       'failed',
          videoUrl:     '',
          thumbnailUrl: null,
          durationSec:  null,
        }).catch(() => {});
      })
      .finally(() => {
        // ✅ Temp file cleanup moved here — FFmpeg needs it during background processing
        if (multerFile?.path) {
          try { fs.unlinkSync(multerFile.path); } catch { /* ignore */ }
        }
      });

  } catch (err) {
    // Cleanup if we never got to the background stage
    if (multerFile?.path) {
      try { fs.unlinkSync(multerFile.path); } catch { /* ignore */ }
    }
    console.error('❌ handleVideoUpload:', err);
    return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
  }
};

// export const handleVideoUpload = async (req, res) => {
//   const multerFile = req.files?.video?.[0]; // ✅ .fields() → req.files, not req.file
//   console.log('multerFile:', JSON.stringify(multerFile, null, 2));

//   try {
//     // ✅ Role check first — before any disk/GCS work
//     if (req.user.role !== 'PLAYER') {
//       return res.status(403).json({
//         success: false,
//         message: 'Only players can upload videos.',
//       });
//     }

//     if (!multerFile) {
//       return res.status(400).json({ success: false, message: 'No video file provided.' });
//     }

//     // ✅ After
//       const { title, description, published } = req.body;
//       console.log('req.body:', req.body); // remove after confirming

//       const titleStr = String(title ?? '').trim();

//       if (!titleStr) {
//         return res.status(400).json({ success: false, message: 'Video title is required.' });
//       }

//       const video = await uploadVideo(
//         multerFile,
//         { title: titleStr, description: String(description ?? ''), published: published === 'true' },
//         req.user.userId,
//       );


//     return res.status(201).json({
//       success: true,
//       message: 'Video uploaded and converted to HLS successfully.',
//       data: video,
//     });

//   } catch (err) {
//     console.error('❌ handleVideoUpload:', err);
//     return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });

//   } finally {
//     // ✅ Always delete the multer temp file from disk
//     // uploadMediaToGCS deliberately leaves this to the route (see comment in multer.js line ~189)
//     if (multerFile?.path) {
//       try { fs.unlinkSync(multerFile.path); } catch { /* ignore */ }
//     }
//   }
// };


// =========================================================
// POST /api/users/avatar
// =========================================================
export const handleAvatarUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    const profile = await uploadAvatar(req.file, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated.',
      data: profile,
    });
  } catch (err) {
    console.error('❌ handleAvatarUpload:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/users/:userId/videos
// =========================================================
export const handleGetUserVideos = async (req, res) => {
  try {
    const playerId = parseInt(req.params.userId, 10);
    if (isNaN(playerId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const videos = await getVideosByUser(playerId);
    return res.status(200).json({ success: true, data: videos });
  } catch (err) {
    console.error('❌ handleGetUserVideos:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/me
// =========================================================
export const handleGetMyProfile = async (req, res) => {
  try {
    const data = await getMyProfileWithVideos(req.user.userId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ handleGetMyProfile:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/videos/:videoId
// =========================================================
export const handleGetVideo = async (req, res) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID.' });
    }

    const viewerId = req.user?.userId ?? null;
    const rawIp    = req.ip || req.headers['x-forwarded-for'] || '';
    const ipHash   = rawIp
      ? Buffer.from(rawIp).toString('base64').slice(0, 32)
      : null;

    const video = await getVideoById(videoId, viewerId, ipHash);
    return res.status(200).json({ success: true, data: video });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Video not found.' });
    }
    console.error('❌ handleGetVideo:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

