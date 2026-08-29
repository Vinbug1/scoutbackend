import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import { detectFrame } from "./Roboflowclient";

// Keeps one active ffmpeg process per match, so we can start/stop tracking
// per match instead of running everything globally.
const activeTrackers = new Map(); // matchId -> { command, isProcessing }

/**
 * Starts pulling frames from a live RTMP/HLS source, running each sampled
 * frame through Roboflow, and emitting detections over Socket.io.
 *
 * @param {string} matchId
 * @param {string} streamUrl - e.g. rtmp://localhost/live/<matchId>
 * @param {import('socket.io').Server} io
 * @param {object} options
 */
function startTrackingMatch(matchId, streamUrl, io, options = {}) {
  if (activeTrackers.has(matchId)) {
    console.log(`⚠️ Tracking already running for match ${matchId}`);
    return;
  }

  const fps = options.fps || 3; // sampled frames per second — tune for cost/latency
  const roomName = `match-${matchId}`;

  const frameStream = new PassThrough();
  const state = { isProcessing: false, frameCount: 0, droppedFrames: 0 };

  const command = ffmpeg(streamUrl)
    .inputOptions(["-re"]) // read input at native frame rate (live pacing)
    .outputOptions([
      `-vf fps=${fps}`,
      "-f image2pipe",
      "-vcodec mjpeg",
      "-q:v 5", // jpeg quality, lower = smaller/faster
    ])
    .on("start", (cmdLine) => {
      console.log(`🎥 Started tracking match ${matchId}`);
      console.log(`   ffmpeg command: ${cmdLine}`);
    })
    .on("error", (err) => {
      console.error(`❌ ffmpeg error for match ${matchId}:`, err.message);
      io.to(roomName).emit("tracking-error", { message: "Stream tracking failed" });
      stopTrackingMatch(matchId);
    })
    .on("end", () => {
      console.log(`🏁 Stream ended for match ${matchId}`);
      stopTrackingMatch(matchId);
    });

  command.pipe(frameStream, { end: true });

  // JPEG frames come through as a continuous byte stream from mjpeg output.
  // We split on JPEG start/end markers (0xFFD8 ... 0xFFD9) to get whole frames.
  let buffer = Buffer.alloc(0);
  const JPEG_START = Buffer.from([0xff, 0xd8]);
  const JPEG_END = Buffer.from([0xff, 0xd9]);

  frameStream.on("data", async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    let startIdx = buffer.indexOf(JPEG_START);
    let endIdx = buffer.indexOf(JPEG_END);

    while (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const frame = buffer.subarray(startIdx, endIdx + 2);
      buffer = buffer.subarray(endIdx + 2);

      handleFrame(frame, matchId, io, roomName, state);

      startIdx = buffer.indexOf(JPEG_START);
      endIdx = buffer.indexOf(JPEG_END);
    }
  });

  activeTrackers.set(matchId, { command, state });
}

async function handleFrame(frameBuffer, matchId, io, roomName, state) {
  // Backpressure control: if we're still waiting on the previous
  // detection call, drop this frame rather than queueing it. This keeps
  // detections close to real-time instead of drifting further behind.
  if (state.isProcessing) {
    state.droppedFrames += 1;
    return;
  }

  state.isProcessing = true;
  state.frameCount += 1;

  try {
    const detections = await detectFrame(frameBuffer);
    io.to(roomName).emit("player-positions", {
      matchId,
      timestamp: Date.now(),
      frameNumber: state.frameCount,
      detections,
    });
  } catch (err) {
    console.error(`⚠️ Detection failed for match ${matchId}:`, err.message);
  } finally {
    state.isProcessing = false;
  }
}

function stopTrackingMatch(matchId) {
  const tracker = activeTrackers.get(matchId);
  if (!tracker) return;

  try {
    tracker.command.kill("SIGKILL");
  } catch (err) {
    console.error(`Error stopping tracker for match ${matchId}:`, err.message);
  }

  console.log(
    `🛑 Stopped tracking match ${matchId} (processed ${tracker.state.frameCount} frames, dropped ${tracker.state.droppedFrames})`
  );
  activeTrackers.delete(matchId);
}

function isTracking(matchId) {
  return activeTrackers.has(matchId);
}

export { startTrackingMatch, stopTrackingMatch, isTracking };