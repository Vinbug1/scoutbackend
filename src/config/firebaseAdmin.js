import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same pattern as gcs-config.js: prefer an env var in production (Coolify
// secret) so the service account JSON never gets committed to the repo.
// Falls back to a local gitignored key file for local dev.
const credential = process.env.FIREBASE_SERVICE_ACCOUNT
  ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  : admin.credential.cert(
      path.join(__dirname, '../../firebase-service-account.json') // gitignored
    );

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

export default admin;