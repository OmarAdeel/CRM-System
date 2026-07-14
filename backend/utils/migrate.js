const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('🔄 Running database migration...');

  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolons and filter out empty statements and comments
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        // Ignore "database already exists" and "table already exists" errors
        if (err.code !== 'ER_DB_CREATE_EXISTS' && err.code !== 'ER_TABLE_EXISTS_ERROR') {
          console.error(`Migration error: ${err.message}`);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
