import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

import { trainModels } from '../services/ml/model-trainer.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tenantIdx = args.indexOf('--tenant');
const tenantId = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;

console.log('Starting ML training...', { dryRun, tenantId: tenantId ?? 'all' });

try {
  await trainModels({ dryRun, tenantId });
  console.log('ML training complete.');
  process.exit(0);
} catch (err) {
  console.error('ML training failed:', err);
  process.exit(1);
}
