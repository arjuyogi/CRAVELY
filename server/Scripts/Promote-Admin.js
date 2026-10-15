
const db = require('../db');

// Usage: node server/scripts/promote-admin.js your-existing-email@example.com
const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error(
    'Usage: node server/scripts/promote-admin.js your-existing-email@example.com'
  );
  process.exitCode = 1;
} else {
  try {
    const user = db.prepare(
      'SELECT id, name, email, role FROM users WHERE lower(email) = ?'
    ).get(email);

    if (!user) {
      console.error('No existing account found for that email.');
      process.exitCode = 1;
    } else if (user.role === 'admin') {
      console.log('This account is already an admin.');
    } else {
      const result = db.prepare(
        "UPDATE users SET role = 'admin' WHERE id = ?"
      ).run(user.id);

      if (result.changes === 1) {
        console.log(`Admin role assigned to: ${user.email}`);
      } else {
        console.error('No account was updated.');
        process.exitCode = 1;
      }
    }
  } finally {
    db.close();
  }
}
