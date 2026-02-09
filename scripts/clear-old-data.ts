import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

async function clearOldData() {
  console.log('Clearing old data...');

  // Delete in order to respect foreign key constraints
  await db.execute(sql`DELETE FROM "Annotation"`);
  console.log('Cleared Annotation');

  await db.execute(sql`DELETE FROM "ReadingProgress"`);
  console.log('Cleared ReadingProgress');

  await db.execute(sql`DELETE FROM "DocumentNote"`);
  console.log('Cleared DocumentNote');

  await db.execute(sql`DELETE FROM "DocumentChunk"`);
  console.log('Cleared DocumentChunk');

  await db.execute(sql`DELETE FROM "EpubChapter"`);
  console.log('Cleared EpubChapter');

  await db.execute(sql`DELETE FROM "DocumentSection"`);
  console.log('Cleared DocumentSection');

  await db.execute(sql`DELETE FROM "DocumentOutline"`);
  console.log('Cleared DocumentOutline');

  await db.execute(sql`DELETE FROM "DocumentPage"`);
  console.log('Cleared DocumentPage');

  await db.execute(sql`DELETE FROM "Note"`);
  console.log('Cleared Note');

  await db.execute(sql`DELETE FROM "Suggestion"`);
  console.log('Cleared Suggestion');

  await db.execute(sql`DELETE FROM "Document"`);
  console.log('Cleared Document');

  console.log('Done!');
  process.exit(0);
}

clearOldData().catch(console.error);
