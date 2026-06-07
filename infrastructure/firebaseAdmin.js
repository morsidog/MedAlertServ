// infrastructure/firebaseAdmin.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const credentials = process.env.FIREBASE_CREDENTIALS;

  if (!credentials) {
    console.error('[Firebase] ⚠️  FIREBASE_CREDENTIALS no está configurada');
  } else {
    try {
      const serviceAccount = JSON.parse(credentials);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase] ✅ Inicializado correctamente');
    } catch (err) {
      console.error('[Firebase] ❌ Error al parsear credenciales:', err.message);
    }
  }
}

module.exports = admin;
