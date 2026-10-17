/*
 * Copy collections from a local MongoDB into a remote one (typically MongoDB Atlas M0).
 *
 *   node scripts/migrateToAtlas.js --dry                 # preview only, writes nothing
 *   node scripts/migrateToAtlas.js                       # copy local -> MONGODB_URI (Atlas)
 *   node scripts/migrateToAtlas.js --source <uri> --dest <uri>
 *   node scripts/migrateToAtlas.js --force               # DROP destination collections first
 *
 * Source defaults to the local dev database; destination defaults to MONGODB_URI.
 *
 * Safety:
 *   - Refuses to write if the destination database already holds data (use --force).
 *   - --force drops ONLY the destination collections being written, never the source.
 *   - Never touches `system.*` collections.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const SOURCE_DEFAULT = 'mongodb://127.0.0.1:27017/timetable_db';

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const DRY = hasFlag('--dry');
const FORCE = hasFlag('--force');
const SOURCE = getArg('--source') || SOURCE_DEFAULT;
const DEST = getArg('--dest') || process.env.MONGODB_URI;

const mask = (uri) => {
  try {
    const u = new URL(uri);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return uri;
  }
};

const connect = (uri) =>
  mongoose.createConnection(uri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 }).asPromise();

const isSystem = (name) => name.startsWith('system.');

const main = async () => {
  console.log('=== MongoDB migration ===');
  console.log('source:', mask(SOURCE));
  console.log('dest  :', DEST ? mask(DEST) : '(none)');
  console.log('mode  :', DRY ? 'DRY RUN (no writes)' : FORCE ? 'FORCE (dest collections dropped first)' : 'normal');

  if (!DEST) {
    console.error('\nERROR: no destination. Set MONGODB_URI in backend/.env or pass --dest <uri>.');
    process.exit(1);
  }
  if (SOURCE === DEST) {
    console.error('\nERROR: source and destination are the same URI.');
    process.exit(1);
  }

  const src = await connect(SOURCE);
  const dst = await connect(DEST);

  try {
    const collections = (await src.db.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !isSystem(n))
      .sort();

    if (collections.length === 0) {
      console.log('\nSource database has no collections to copy.');
      return;
    }

    // Safety: refuse to overwrite a destination that already has data.
    if (!FORCE) {
      const destColls = (await dst.db.listCollections().toArray())
        .map((c) => c.name)
        .filter((n) => !isSystem(n));
      let destDocs = 0;
      for (const name of destColls) destDocs += await dst.db.collection(name).countDocuments();
      if (destDocs > 0) {
        console.error(
          `\nABORT: destination already contains ${destDocs} document(s) in ${destColls.length} collection(s).`
        );
        console.error('Re-run with --force to DROP those destination collections and re-copy.');
        process.exit(2);
      }
    }

    let totalSrc = 0;
    let totalCopied = 0;
    const summary = [];

    for (const name of collections) {
      const count = await src.db.collection(name).countDocuments();
      totalSrc += count;
      let copied = 0;

      if (count > 0) {
        if (!DRY) {
          if (FORCE) await dst.db.collection(name).drop().catch(() => {});
          const docs = await src.db.collection(name).find({}).toArray();
          for (let i = 0; i < docs.length; i += 500) {
            const batch = docs.slice(i, i + 500);
            await dst.db.collection(name).insertMany(batch, { ordered: false });
            copied += batch.length;
          }
        } else {
          copied = count;
        }
      }

      totalCopied += copied;
      summary.push({ name, count, copied });
    }

    console.log('\nCollection summary:');
    for (const s of summary) {
      console.log(`  ${s.name.padEnd(28)} src=${String(s.count).padStart(5)}  ${DRY ? 'would copy' : 'copied=' + s.copied}`);
    }
    console.log(`\nTotal source documents: ${totalSrc}`);
    console.log(DRY ? `DRY RUN complete — nothing written. Remove --dry to perform the copy.` : `Copied ${totalCopied} document(s) to ${mask(DEST)}`);

    if (!DRY) {
      console.log('\nNext: set MONGODB_URI in the Render environment and restart the backend.');
    }
  } finally {
    await src.close().catch(() => {});
    await dst.close().catch(() => {});
  }
};

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
