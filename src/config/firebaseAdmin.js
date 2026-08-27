import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credential = process.env.FIREBASE_SERVICE_ACCOUNT
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  : cert(path.join(__dirname, '../../firebase-service-account.json'));

let app;
if (!getApps().length) {
  app = initializeApp({ credential });
}

export default app;