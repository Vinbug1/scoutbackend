import express from "express";
import { startTrackingMatch, stopTrackingMatch, isTracking } from "../services/Livetracker.js";

const router = express.Router();

// Pulls io from req.app.get('io') to match your existing app.js pattern
// (app.set('io', io) is called inside startServer(), after routes are
// mounted, so io must be read per-request rather than captured at
// module-load time).

router.post("/matches/:matchId/start", (req, res) => {
  const { matchId } = req.params;
  const { streamUrl, fps } = req.body;
  const io = req.app.get("io");

  if (!streamUrl) {
    return res.status(400).json({ message: "streamUrl is required" });
  }

  if (!io) {
    return res.status(503).json({ message: "Socket.io not ready yet" });
  }

  if (isTracking(matchId)) {
    return res.status(409).json({ message: "Tracking already running for this match" });
  }

  startTrackingMatch(matchId, streamUrl, io, { fps });

  return res.status(200).json({
    message: `Started tracking match ${matchId}`,
    socketRoom: `match-${matchId}`,
  });
});

router.post("/matches/:matchId/stop", (req, res) => {
  const { matchId } = req.params;

  if (!isTracking(matchId)) {
    return res.status(404).json({ message: "No active tracking for this match" });
  }

  stopTrackingMatch(matchId);
  return res.status(200).json({ message: `Stopped tracking match ${matchId}` });
});

router.get("/matches/:matchId/status", (req, res) => {
  const { matchId } = req.params;
  return res.status(200).json({ tracking: isTracking(matchId) });
});

export default router;