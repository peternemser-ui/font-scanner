/**
 * Script to grant admin privileges to a user
 * Usage: node make-admin.js <email>
 * Example: node make-admin.js peternemser@yahoo.com
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'fontscanner.db');
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email address required');
  console.log('Usage: node make-admin.js <email>');
  console.log('Example: node make-admin.js peternemser@yahoo.com');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
});

// First, check if the user exists
db.get('SELECT id, email, is_admin FROM users WHERE LOWER(email) = LOWER(?)', [email], (err, user) => {
  if (err) {
    console.error('❌ Database error:', err.message);
    db.close();
    process.exit(1);
  }

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log('\nTip: Make sure the user has registered first at /auth.html');
    db.close();
    process.exit(1);
  }

  // Check if already admin
  if (user.is_admin === 1) {
    console.log(`ℹ️  User ${user.email} is already an admin`);
    db.close();
    process.exit(0);
  }

  // Grant admin privileges
  db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id], function(err) {
    if (err) {
      console.error('❌ Error granting admin privileges:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('✅ Admin privileges granted successfully!');
    console.log(`\nUser: ${user.email}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Admin: Yes`);
    console.log(`\nYou can now access the admin dashboard at /admin.html`);

    db.close();
  });
});
