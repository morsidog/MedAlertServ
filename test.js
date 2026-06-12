require('dotenv').config();
const db = require('./db/database');

async function run() {

  // ── 1. COLUMNA password_updated_at en cuentas (HU-40) ────────────
  await safe(db.query(`
    ALTER TABLE cuentas
      ADD COLUMN password_updated_at DATETIME NULL DEFAULT NULL
  `), 'cuentas: password_updated_at');

  // ── 2. COLUMNA intervalo_minutos en horarios ──────────────────────
  await safe(db.query(`
    ALTER TABLE horarios
      ADD COLUMN intervalo_minutos INT NULL DEFAULT NULL
      COMMENT 'Si tiene valor, es alarma por intervalo. NULL = horario fijo'
  `), 'horarios: intervalo_minutos');

  // ── 3. COLUMNA firmware_version en dispositivos (HU-41) ──────────
  await safe(db.query(`
    ALTER TABLE dispositivos
      ADD COLUMN firmware_version VARCHAR(20) NULL DEFAULT NULL
  `), 'dispositivos: firmware_version');

  console.log('\n✅ sync_db_v2 completo');
  process.exit(0);
}

async function safe(promise, label) {
  try {
    await promise;
    console.log(`✅ ${label}`);
  } catch (e) {
    console.log(`⚠️  ${label}: ${e.message}`);
  }
}

run().catch(e => {
  console.error('ERROR FATAL:', e.message);
  process.exit(1);
});