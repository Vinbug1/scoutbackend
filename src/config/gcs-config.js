import { Storage } from '@google-cloud/storage';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storageConfig = process.env.GCP_CREDENTIALS_JSON
  ? {
      credentials: JSON.parse(process.env.GCP_CREDENTIALS_JSON),
      projectId: process.env.GCLOUD_PROJECT_ID,
    }
  : {
      keyFilename: path.join(__dirname, '../../scoutimg-aa6e95184dbd.json'),
      projectId: process.env.GCLOUD_PROJECT_ID,
    };

const storage = new Storage(storageConfig);
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

export { storage, bucket };















// import { Storage } from '@google-cloud/storage';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import dotenv from 'dotenv';

// dotenv.config();

// // Create __dirname equivalent for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Load Google Cloud credentials
// const storage = new Storage({
//   keyFilename: path.join(__dirname, '../../scoutimg-aa6e95184dbd.json'),
//   projectId: process.env.GCLOUD_PROJECT_ID,
// });

// const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// export { storage, bucket };

