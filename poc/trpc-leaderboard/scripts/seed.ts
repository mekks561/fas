import 'dotenv/config';
import { seedIfEmpty, totalCount } from '../src/store.js';

seedIfEmpty()
  .then(async () => {
    const count = await totalCount();
    console.log(`[seed] done, total entries: ${count}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  });
