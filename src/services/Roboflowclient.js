import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
// Example: "https://detect.roboflow.com/football-players-detection/1"
const MODEL_ENDPOINT = process.env.ROBOFLOW_MODEL_ENDPOINT;

if (!ROBOFLOW_API_KEY || !MODEL_ENDPOINT) {
  console.warn(
    "⚠️ ROBOFLOW_API_KEY or ROBOFLOW_MODEL_ENDPOINT is not set. Detection calls will fail."
  );
}

/**
 * Sends a single JPEG frame buffer to Roboflow for inference.
 * Returns an array of predictions:
 * [{ class, confidence, x, y, width, height }, ...]
 */
async function detectFrame(imageBuffer, { timeoutMs = 3000 } = {}) {
  const form = new FormData();
  form.append("file", imageBuffer, { filename: "frame.jpg" });

  const response = await axios.post(
    `${MODEL_ENDPOINT}?api_key=${ROBOFLOW_API_KEY}`,
    form,
    {
      headers: form.getHeaders(),
      timeout: timeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  return response.data.predictions || [];
}

export { detectFrame };