/**
 * Run once to create the admin account:
 * node scripts/createAdmin.js
 */
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { db } = require('../firebase');

async function main() {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    const existing = await db.collection('wbp_users')
        .where('username', '==', username)
        .limit(1).get();

    if (!existing.empty) {
        console.log('Admin already exists.');
        process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ref = await db.collection('wbp_users').add({
        username,
        displayName: 'Admin',
        passwordHash,
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString()
    });

    console.log(`✅ Admin created: ${username} | uid: ${ref.id}`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
