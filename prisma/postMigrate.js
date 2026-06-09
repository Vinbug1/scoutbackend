// prisma/postMigrate.js
// ─────────────────────────────────────────────────────────────────────────────
// After every migration:
// 1. Detects dropped tables from latest migration SQL
// 2. Renumbers ALL existing rows from 1 (no gaps)
// 3. Fixes all foreign key references to match new IDs
// 4. Resets sequences to max(id) + 1
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// Table definitions — order matters (parents before children)
// refs = child tables that have a FK pointing to this table
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_DEFINITIONS = [
  {
    table: 'User',
    refs: [
      { table: 'Profile',              column: 'userId' },
      { table: 'ScoutProfile',         column: 'userId' },
      { table: 'Video',                column: 'playerId' },
      { table: 'Reel',                 column: 'playerId' },
      { table: 'VideoView',            column: 'userId' },
      { table: 'ReelView',             column: 'userId' },
      { table: 'Comment',              column: 'userId' },
      { table: 'Rating',               column: 'userId' },
      { table: 'Ranking',              column: 'userId' },
      { table: 'Payment',              column: 'userId' },
      { table: 'ChatMessage',          column: 'userId' },
      { table: 'ChatRoomMember',       column: 'userId' },
      { table: 'Post',                 column: 'userId' },
      { table: 'Follower',             column: 'followerId' },
      { table: 'Follower',             column: 'followedId' },
      { table: 'ScouterReport',        column: 'scouterId' },
      { table: 'ScouterReport',        column: 'playerId' },
      { table: 'Challenge',            column: 'creatorId' },
      { table: 'ChallengeParticipant', column: 'userId' },
    ],
  },
  {
    table: 'VideoCategory',
    refs: [
      { table: 'Reel', column: 'categoryId' },
    ],
  },
  {
    table: 'Video',
    refs: [
      { table: 'VideoView', column: 'videoId' },
      { table: 'Comment',   column: 'videoId' },
      { table: 'Rating',    column: 'videoId' },
    ],
  },
  {
    table: 'Reel',
    refs: [
      { table: 'ReelView', column: 'reelId' },
      { table: 'Comment',  column: 'reelId' },
      { table: 'Rating',   column: 'reelId' },
    ],
  },
  {
    table: 'Challenge',
    refs: [
      { table: 'ChallengeParticipant', column: 'challengeId' },
    ],
  },
  {
    table: 'ChallengeParticipant',
    refs: [
      { table: 'ProgressLog', column: 'participantId' },
    ],
  },
  {
    table: 'ChatRoom',
    refs: [
      { table: 'ChatMessage',    column: 'roomId' },
      { table: 'ChatRoomMember', column: 'roomId' },
    ],
  },
  {
    table: 'Post',
    refs: [
      { table: 'Comment', column: 'postId' },
    ],
  },
  // Leaf tables (no children referencing them)
  { table: 'Profile',              refs: [] },
  { table: 'ScoutProfile',         refs: [] },
  { table: 'VideoView',            refs: [] },
  { table: 'ReelView',             refs: [] },
  { table: 'Comment',              refs: [] },
  { table: 'Rating',               refs: [] },
  { table: 'Ranking',              refs: [] },
  { table: 'Payment',              refs: [] },
  { table: 'ChatMessage',          refs: [] },
  { table: 'ChatRoomMember',       refs: [] },
  { table: 'ScouterReport',        refs: [] },
  { table: 'Follower',             refs: [] },
  { table: 'ProgressLog',          refs: [] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Get latest migration SQL
// ─────────────────────────────────────────────────────────────────────────────
function getLatestMigrationSQL() {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return null;

  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort()
    .reverse();

  if (!folders.length) return null;

  const sqlFile = path.join(migrationsDir, folders[0], 'migration.sql');
  return fs.existsSync(sqlFile) ? fs.readFileSync(sqlFile, 'utf8') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse dropped tables from migration SQL
// ─────────────────────────────────────────────────────────────────────────────
function getDroppedTables(sql) {
  if (!sql) return [];
  const dropped = [];
  const regex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) dropped.push(match[1]);
  return dropped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get tables that currently exist in DB
// ─────────────────────────────────────────────────────────────────────────────
async function getExistingTables() {
  const result = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  return result.map((r) => r.tablename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Renumber rows from 1, fix FK references, handle gaps
// ─────────────────────────────────────────────────────────────────────────────
async function renumberTable(tableName, refs, existingTables) {
  const countResult = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM "${tableName}"`
  );
  const count = Number(countResult[0].count);

  if (count === 0) {
    console.log(`  ⏭️  "${tableName}" — empty, skipping`);
    return;
  }

  // Check for gaps
  const gapCheck = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
      FROM "${tableName}"
    ) t WHERE id != rn
  `);
  const gaps = Number(gapCheck[0].count);

  if (gaps === 0) {
    console.log(`  ✅ "${tableName}" — clean (1 to ${count}, no gaps)`);
    return;
  }

  console.log(`  🔄 "${tableName}" — fixing ${gaps} gaps across ${count} rows...`);

  // Step 1: Drop FK constraints on child tables temporarily
  for (const ref of refs) {
    if (!existingTables.includes(ref.table)) continue;
    try {
      const constraints = await prisma.$queryRawUnsafe(`
        SELECT conname FROM pg_constraint
        JOIN pg_class ON conrelid = pg_class.oid
        WHERE pg_class.relname = '${ref.table}'
          AND contype = 'f'
          AND pg_get_constraintdef(pg_constraint.oid) LIKE '%${tableName}%'
      `);
      for (const c of constraints) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${ref.table}" DROP CONSTRAINT IF EXISTS "${c.conname}"`
        );
      }
    } catch (err) {
      console.warn(`    ⚠️  Drop FK failed "${ref.table}.${ref.column}": ${err.message}`);
    }
  }

  // Step 2: Get all IDs in order
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM "${tableName}" ORDER BY id`
  );

  // Step 3: Update FKs and assign temp negative IDs
  for (let i = 0; i < rows.length; i++) {
    const oldId = rows[i].id;
    const newId = i + 1;
    if (oldId === newId) continue;

    // Update FK references in child tables
    for (const ref of refs) {
      if (!existingTables.includes(ref.table)) continue;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "${ref.table}" SET "${ref.column}" = ${newId} WHERE "${ref.column}" = ${oldId}`
        );
      } catch (err) {
        console.warn(`    ⚠️  FK update failed "${ref.table}.${ref.column}": ${err.message}`);
      }
    }

    // Assign temp negative ID to avoid unique conflicts
    await prisma.$executeRawUnsafe(
      `UPDATE "${tableName}" SET id = ${-newId} WHERE id = ${oldId}`
    );
  }

  // Step 4: Flip negatives to final positive IDs
  await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET id = -id WHERE id < 0`
  );

  // Step 5: Re-add FK constraints
  for (const ref of refs) {
    if (!existingTables.includes(ref.table)) continue;
    try {
      const constraintName = `${ref.table}_${ref.column}_fkey`;
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${ref.table}"
        ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${ref.column}") REFERENCES "${tableName}"(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
      `);
    } catch (err) {
      console.warn(`    ⚠️  Re-add FK failed "${ref.table}.${ref.column}": ${err.message}`);
    }
  }

  console.log(`  ✅ "${tableName}" — renumbered 1 to ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset sequence to max(id) + 1
// ─────────────────────────────────────────────────────────────────────────────
async function resetSequence(tableName) {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(MAX(id), 0) AS max_id FROM "${tableName}"`
    );
    const nextVal = Number(result[0].max_id) + 1;
    await prisma.$executeRawUnsafe(
      `ALTER SEQUENCE "${tableName}_id_seq" RESTART WITH ${nextVal}`
    );
    console.log(`  🔢 "${tableName}" — sequence → ${nextVal}`);
  } catch (err) {
    console.warn(`  ⚠️  "${tableName}" sequence skipped: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Post-migration cleanup starting...\n');

  const latestSQL      = getLatestMigrationSQL();
  const droppedTables  = getDroppedTables(latestSQL);
  const existingTables = await getExistingTables();

  if (droppedTables.length) {
    console.log(`🗑️  Dropped in latest migration: ${droppedTables.join(', ')}\n`);
  }

  console.log('📐 Renumbering rows (fixing gaps):\n');
  for (const def of TABLE_DEFINITIONS) {
    if (existingTables.includes(def.table)) {
      await renumberTable(def.table, def.refs, existingTables);
    }
  }

  console.log('\n🔢 Resetting sequences:\n');
  for (const def of TABLE_DEFINITIONS) {
    if (existingTables.includes(def.table)) {
      await resetSequence(def.table);
    }
  }

  console.log('\n✅ Post-migration cleanup complete.\n');
}

main()
  .catch((err) => {
    console.error('❌ postMigrate failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());