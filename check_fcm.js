require('dotenv').config();
const db = require('./db/database');
async function run() {
  const [tokens] = await db.query(`
    SELECT ft.id, ft.id_cuenta, c.nombre, c.correo, 
           t.tipo AS rol, ft.token, ft.actualizado
      FROM fcm_tokens ft
      JOIN cuentas c ON c.id = ft.id_cuenta
      JOIN tipos_cuenta t ON t.id = c.tipo
     ORDER BY ft.actualizado DESC
  `);
  if (!tokens.length) {
    console.log('❌ Ningún token FCM en la DB — la app no está enviando el token al backend');
    console.log('   Verifica que google-services.json esté en app/ y que compilaste con Firebase');
  } else {
    console.log('✅ Tokens registrados:');
    tokens.forEach(t => {
      console.log(`  cuenta_id=${t.id_cuenta} (${t.nombre}/${t.rol}) | token=${t.token.substring(0,30)}... | actualizado=${t.actualizado}`);
    });

    // Intentar envío de prueba
    const cred = process.env.FIREBASE_CREDENTIALS;
    if (!cred) { console.log('\n❌ FIREBASE_CREDENTIALS no está en .env'); process.exit(0); }
    
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(cred)) });
    
    console.log('\nEnviando notificación de prueba...');
    for (const t of tokens) {
      try {
        const r = await admin.messaging().send({
          token: t.token,
          notification: { title: 'MedAlert prueba', body: 'Si ves esto, FCM funciona' },
          android: { priority: 'high' }
        });
        console.log(`  ✅ ${t.nombre}: ${r}`);
      } catch(e) {
        console.log(`  ❌ ${t.nombre}: ${e.message} (código: ${e.code})`);
      }
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
