const admin = require('firebase-admin');
const path = require('path');

let initialized = false;

function initFirebase() {
    if (initialized) return;

    // Use service account JSON file directly (simplest approach)
    const serviceAccount = require(path.join(__dirname, 'fake-1582b-firebase-adminsdk-fbsvc-878526e19e.json'));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://fake-1582b-default-rtdb.firebaseio.com'
    });

    initialized = true;
    console.log('✅ Firebase initialized');
}

initFirebase();

const db = admin.firestore();
const rtdb = admin.database();

module.exports = { db, rtdb, admin };
