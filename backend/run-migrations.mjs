// Railway pre-deploy migration runner.
// Reads SQL files from dist/db/migrations/ and executes them in order.
// Uses pg (production dependency) and DATABASE_URL from environment.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const dir = 'dist/db/migrations';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    await client.query(readFileSync(join(dir, file), 'utf8'));
    console.log(`Applied: ${file}`);
  }
  console.log(`Migrations complete (${files.length} files)`);
} finally {
  await client.end();
}
