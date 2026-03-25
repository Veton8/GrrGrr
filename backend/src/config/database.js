const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', '..', 'grgr.db');
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

/**
 * Compatibility layer that mimics pg's query interface but uses SQLite.
 * Converts $1, $2... param placeholders to ? placeholders.
 */
function query(text, params = []) {
  // Convert PostgreSQL-style $1, $2 placeholders to ?
  let sqliteText = text;
  // Replace $N with ? (in order)
  const paramMap = [];
  sqliteText = text.replace(/\$(\d+)/g, (match, num) => {
    paramMap.push(parseInt(num));
    return '?';
  });

  // Reorder params to match the ? order
  const orderedParams = paramMap.map((idx) => {
    const val = params[idx - 1];
    // SQLite doesn't support boolean directly
    if (val === true) return 1;
    if (val === false) return 0;
    if (val === undefined) return null;
    // Handle arrays (used in ANY($n) queries - we'll handle those separately)
    if (Array.isArray(val)) return JSON.stringify(val);
    return val;
  });

  // Handle PostgreSQL-specific syntax
  sqliteText = sqliteText.replace(/gen_random_uuid\(\)/g, `'${uuidv4()}'`);
  sqliteText = sqliteText.replace(/NOW\(\)/gi, "datetime('now')");
  sqliteText = sqliteText.replace(/TIMESTAMP/gi, 'TEXT');
  sqliteText = sqliteText.replace(/BOOLEAN/gi, 'INTEGER');
  sqliteText = sqliteText.replace(/VARCHAR\(\d+\)/gi, 'TEXT');
  sqliteText = sqliteText.replace(/SERIAL/gi, 'INTEGER');

  // Handle ON CONFLICT DO NOTHING (SQLite uses OR IGNORE)
  sqliteText = sqliteText.replace(
    /INSERT INTO (.+?) \((.+?)\) VALUES \((.+?)\) ON CONFLICT DO NOTHING/gi,
    'INSERT OR IGNORE INTO $1 ($2) VALUES ($3)'
  );

  // Handle COALESCE with PostgreSQL update patterns
  // Handle GREATEST
  sqliteText = sqliteText.replace(/GREATEST\((.+?),\s*(\d+)\)/gi, 'MAX($1, $2)');

  // Handle = ANY($n) pattern - convert to IN
  sqliteText = sqliteText.replace(/= ANY\(\?\)/gi, (match) => {
    return 'IN (SELECT value FROM json_each(?))';
  });

  // Remove DEFAULT gen_random_uuid() from CREATE TABLE
  sqliteText = sqliteText.replace(/DEFAULT\s+'[0-9a-f-]+'/gi, '');

  // Handle RETURNING clause - SQLite doesn't support it the same way
  const returningMatch = sqliteText.match(/RETURNING\s+(.+?)$/im);

  // Detect statement type
  const trimmed = sqliteText.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT');
  const isInsert = trimmed.startsWith('INSERT');
  const isUpdate = trimmed.startsWith('UPDATE');
  const isDelete = trimmed.startsWith('DELETE');
  const isCreate = trimmed.startsWith('CREATE');
  const isBegin = trimmed === 'BEGIN';
  const isCommit = trimmed === 'COMMIT';
  const isRollback = trimmed === 'ROLLBACK';

  try {
    if (isBegin) {
      sqlite.exec('BEGIN');
      return { rows: [] };
    }
    if (isCommit) {
      sqlite.exec('COMMIT');
      return { rows: [] };
    }
    if (isRollback) {
      sqlite.exec('ROLLBACK');
      return { rows: [] };
    }

    if (isCreate) {
      // For CREATE TABLE/INDEX statements, handle multi-statement blocks
      const statements = sqliteText.split(';').filter((s) => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            sqlite.exec(stmt.trim() + ';');
          } catch (e) {
            // Ignore errors for CREATE IF NOT EXISTS
            if (!e.message.includes('already exists')) {
              console.warn('Migration statement warning:', e.message);
            }
          }
        }
      }
      return { rows: [] };
    }

    if (isSelect) {
      const rows = sqlite.prepare(sqliteText).all(...orderedParams);
      return { rows };
    }

    if (isInsert || isUpdate || isDelete) {
      if (returningMatch) {
        // Remove RETURNING clause from the SQL
        const sqlWithoutReturning = sqliteText.replace(/\s+RETURNING\s+.+$/im, '');
        const info = sqlite.prepare(sqlWithoutReturning).run(...orderedParams);

        // For INSERT, fetch the inserted row
        if (isInsert && returningMatch) {
          const tableName = sqliteText.match(/INTO\s+(\w+)/i)?.[1];
          if (tableName) {
            // Use last_insert_rowid or find by the UUID we generated
            const cols = returningMatch[1].trim();
            let selectSql;
            if (cols === '*') {
              selectSql = `SELECT * FROM ${tableName} WHERE rowid = last_insert_rowid()`;
            } else {
              selectSql = `SELECT ${cols} FROM ${tableName} WHERE rowid = last_insert_rowid()`;
            }
            try {
              const rows = sqlite.prepare(selectSql).all();
              return { rows, rowCount: info.changes };
            } catch {
              return { rows: [], rowCount: info.changes };
            }
          }
        }

        // For UPDATE/DELETE with RETURNING
        if ((isUpdate || isDelete) && returningMatch) {
          // We can't easily get RETURNING rows from SQLite for UPDATE/DELETE
          // Return the change count
          return { rows: [{ changes: info.changes }], rowCount: info.changes };
        }
      }

      const info = sqlite.prepare(sqliteText).run(...orderedParams);
      return { rows: [], rowCount: info.changes };
    }

    // Fallback - try to execute
    sqlite.exec(sqliteText);
    return { rows: [] };
  } catch (err) {
    console.error('DB Error:', err.message);
    console.error('SQL:', sqliteText);
    console.error('Params:', orderedParams);
    throw err;
  }
}

module.exports = { query, sqlite };
