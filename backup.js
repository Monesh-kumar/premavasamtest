/**
 * ══════════════════════════════════════════════════════════════════════
 * PREMA VASAM • Automated WAL-Safe SQLite Backup & Recovery Suite
 * Atomic Online Snapshots (VACUUM INTO) • Integrity Verification • Retention Pruning
 * ══════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Native .env loader
if (typeof process.loadEnvFile === 'function') {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try { process.loadEnvFile(envPath); } catch (_) {}
  }
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
const BACKUP_RETENTION = parseInt(process.env.BACKUP_RETENTION, 10) || 7;

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${MM}-${dd}_${HH}-${mm}-${ss}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function verifyDatabaseIntegrity(filePath) {
  let testDb = null;
  try {
    testDb = new DatabaseSync(filePath, { readOnly: true });
    const result = testDb.prepare('PRAGMA integrity_check;').all();
    const isOk = result.length > 0 && result[0].integrity_check === 'ok';
    return { ok: isOk, details: result };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (testDb) {
      try { testDb.close(); } catch (_) {}
    }
  }
}

function pruneOldBackups(backupDir, retentionCount) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('premavasam_backup_') && f.endsWith('.sqlite'))
      .map(f => {
        const fullPath = path.join(backupDir, f);
        return {
          name: f,
          path: fullPath,
          time: fs.statSync(fullPath).mtimeMs
        };
      })
      .sort((a, b) => b.time - a.time); // newest first

    if (files.length > retentionCount) {
      const toDelete = files.slice(retentionCount);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        console.log(`[BACKUP] Pruned expired backup: ${item.name}`);
      }
    }
  } catch (err) {
    console.error('[BACKUP WARNING] Error pruning old backups:', err.message);
  }
}

async function performBackup() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[BACKUP ERROR] Source database not found at: ${DB_PATH}`);
    process.exit(1);
  }

  ensureDir(BACKUP_DIR);
  const backupFilename = `premavasam_backup_${getTimestamp()}.sqlite`;
  const backupFilePath = path.join(BACKUP_DIR, backupFilename);

  console.log(`[BACKUP] Initiating WAL-safe atomic backup...`);
  console.log(`  Source: ${DB_PATH}`);
  console.log(`  Target: ${backupFilePath}`);

  let liveDb = null;
  try {
    // Open live DB and execute VACUUM INTO
    liveDb = new DatabaseSync(DB_PATH);
    const escapedTarget = backupFilePath.replace(/'/g, "''");
    liveDb.exec(`VACUUM INTO '${escapedTarget}';`);
    console.log(`[BACKUP] Snapshot written successfully.`);
  } catch (err) {
    console.error(`[BACKUP FAILED] Error during VACUUM INTO:`, err.message);
    if (fs.existsSync(backupFilePath)) {
      try { fs.unlinkSync(backupFilePath); } catch (_) {}
    }
    process.exit(1);
  } finally {
    if (liveDb) {
      try { liveDb.close(); } catch (_) {}
    }
  }

  // Verify integrity of newly created backup
  console.log(`[BACKUP] Verifying integrity of backup file...`);
  const integrity = verifyDatabaseIntegrity(backupFilePath);
  if (!integrity.ok) {
    console.error(`[BACKUP FAILED] Integrity check failed:`, integrity);
    process.exit(1);
  }
  const stats = fs.statSync(backupFilePath);
  console.log(`[BACKUP VERIFIED] Integrity check OK (File size: ${(stats.size / 1024).toFixed(2)} KB).`);

  // Prune older backups
  pruneOldBackups(BACKUP_DIR, BACKUP_RETENTION);

  console.log(`[BACKUP COMPLETE] Backup saved: ${backupFilename}`);
  return backupFilePath;
}

function testRestore(backupFile) {
  if (!backupFile || !fs.existsSync(backupFile)) {
    console.error(`[RESTORE ERROR] Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  console.log(`[RESTORE TEST] Testing non-destructive restoration of ${backupFile}...`);
  const testDbPath = path.join(BACKUP_DIR, 'test_restore_verification.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  try {
    // Copy backup to isolated test destination
    fs.copyFileSync(backupFile, testDbPath);
    console.log(`  Copied to isolated verification sandbox: ${testDbPath}`);

    // Verify integrity of restored database
    const integrity = verifyDatabaseIntegrity(testDbPath);
    if (!integrity.ok) {
      throw new Error(`Restored database failed integrity check: ${JSON.stringify(integrity)}`);
    }

    // Inspect records and tables
    const testDb = new DatabaseSync(testDbPath, { readOnly: true });
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`  Restored tables: ${tables.map(t => t.name).join(', ')}`);

    const mealsCount = testDb.prepare("SELECT COUNT(*) AS c FROM meals").get().c;
    const donationsCount = testDb.prepare("SELECT COUNT(*) AS c FROM donations").get().c;
    const volunteersCount = testDb.prepare("SELECT COUNT(*) AS c FROM volunteers").get().c;
    const contactsCount = testDb.prepare("SELECT COUNT(*) AS c FROM contacts").get().c;

    console.log(`  Record counts: Meals=${mealsCount}, Donations=${donationsCount}, Volunteers=${volunteersCount}, Contacts=${contactsCount}`);
    testDb.close();

    console.log(`[RESTORE TEST PASSED] Database verified cleanly without touching production.`);
  } finally {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (_) {}
    }
  }
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--verify-restore')) {
    const fileIdx = args.indexOf('--verify-restore') + 1;
    const targetFile = args[fileIdx];
    testRestore(targetFile);
  } else {
    performBackup().then(file => {
      if (args.includes('--test-restore')) {
        testRestore(file);
      }
    }).catch(err => {
      console.error('[BACKUP ERROR]', err);
      process.exit(1);
    });
  }
}

module.exports = {
  performBackup,
  verifyDatabaseIntegrity,
  pruneOldBackups,
  testRestore
};
