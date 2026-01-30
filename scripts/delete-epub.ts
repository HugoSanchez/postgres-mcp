import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { document, epubChapter, documentOutline, highlight } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  // Find EPUB documents
  const docs = await db
    .select()
    .from(document)
    .where(eq(document.mimeType, 'application/epub+zip'));

  console.log('EPUB documents found:', docs.length);

  for (const doc of docs) {
    console.log(`\nDeleting: ${doc.title} (${doc.id})`);

    // Delete highlights first (foreign key constraint)
    await db
      .delete(highlight)
      .where(eq(highlight.documentId, doc.id));
    console.log('  - Deleted highlights');

    // Delete chapters
    await db
      .delete(epubChapter)
      .where(eq(epubChapter.documentId, doc.id));
    console.log('  - Deleted chapters');

    // Delete outline
    await db
      .delete(documentOutline)
      .where(eq(documentOutline.documentId, doc.id));
    console.log('  - Deleted outline');

    // Delete document
    await db.delete(document).where(eq(document.id, doc.id));
    console.log('  - Deleted document');
  }

  console.log('\nDone!');
  await client.end();
}

main().catch(console.error);
