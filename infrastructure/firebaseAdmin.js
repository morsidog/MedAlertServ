// infrastructure/firebaseAdmin.js
const admin = require('firebase-admin');
const path  = require('path');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      path.join(__dirname, '..', 'firebase-credentials.json')
    )
  });
}

module.exports = admin;
