// application/notificacionService.js
const admin  = require('../infrastructure/firebaseAdmin');
const repo   = require('../infrastructure/notificacionRepository');

async function enviarNotificacion(token, titulo, cuerpo, datos = {}) {
  if (!token) return false;
  try {
    await admin.messaging().send({
      token,
      notification: { title: titulo, body: cuerpo },
      data: datos,
      android: {
        priority: datos.urgente === 'true' ? 'high' : 'normal',
        notification: {
          channelId: datos.urgente === 'true' ? 'medalert_urgente' : 'medalert_default',
          priority:  datos.urgente === 'true' ? 'max' : 'default',
        }
      }
    });
    return true;
  } catch (err) {
    console.error('[FCM] Error enviando notificación:', err.message);
    return false;
  }
}

async function enviarMulticast(tokens, titulo, cuerpo, datos = {}) {
  const validos = (tokens || []).filter(Boolean);
  if (!validos.length) return;
  try {
    await admin.messaging().sendEachForMulticast({
      tokens: validos,
      notification: { title: titulo, body: cuerpo },
      data: datos,
      android: {
        priority: 'high',
        notification: { channelId: 'medalert_urgente', priority: 'max' }
      }
    });
  } catch (err) {
    console.error('[FCM] Error multicast:', err.message);
  }
}

async function registrarToken(id_cuenta, token) {
  await repo.guardarToken(id_cuenta, token);
}

async function checkEscalamiento() {

  // ── Nivel 0 → 1 (entre 5 y 15 min) ────────────────────────────
  const nivel0 = await repo.obtenerTomasPendientesParaEscalar(5, 15, 0);
  if (nivel0.length) console.log(`[Escalamiento] ${nivel0.length} toma(s) para nivel 1`);
  for (const toma of nivel0) {
    const datos = await repo.obtenerDatosToma(toma.id);
    if (!datos) continue;
    const token = await repo.obtenerToken(datos.id_paciente);
    console.log(`[Escalamiento] Nivel 1 toma ${toma.id} — token: ${token ? token.slice(0,20)+'...' : 'NINGUNO'}`);
    const ok = await enviarNotificacion(token,
      `MedAlert — ${datos.nombre_paciente}`,
      `Es hora de tomar ${datos.medicamento} ${datos.dosis_mg}mg`,
      { id_toma: String(toma.id), nivel: '1' }
    );
    console.log(`[Escalamiento] Nivel 1 → toma ${toma.id}: ${ok ? '✅' : '❌'}`);
    await repo.actualizarNivel(toma.id, 1);
    await repo.registrarAlerta(toma.id, 1);
  }

  // ── Nivel 1 → 2 (entre 15 y 30 min) ───────────────────────────
  const nivel1 = await repo.obtenerTomasPendientesParaEscalar(15, 30, 1);
  if (nivel1.length) console.log(`[Escalamiento] ${nivel1.length} toma(s) para nivel 2`);
  for (const toma of nivel1) {
    const datos = await repo.obtenerDatosToma(toma.id);
    if (!datos) continue;
    const familiares = await repo.obtenerTokensFamiliares(datos.id_paciente);
    const principal  = familiares.find(f => f.es_principal);
    const ok = await enviarNotificacion(principal?.token ?? null,
      `MedAlert — ${datos.nombre_paciente}`,
      `${datos.medicamento}: toma sin confirmar hace 15 minutos`,
      { id_toma: String(toma.id), nivel: '2', id_paciente: String(datos.id_paciente) }
    );
    console.log(`[Escalamiento] Nivel 2 → toma ${toma.id}: ${ok ? '✅' : '❌'}`);
    await repo.actualizarNivel(toma.id, 2);
    await repo.registrarAlerta(toma.id, 2);
  }

  // ── Nivel 2 → 3 (entre 30 y 60 min) ───────────────────────────
  const nivel2 = await repo.obtenerTomasPendientesParaEscalar(30, 60, 2);
  if (nivel2.length) console.log(`[Escalamiento] ${nivel2.length} toma(s) para nivel 3`);
  for (const toma of nivel2) {
    const datos = await repo.obtenerDatosToma(toma.id);
    if (!datos) continue;
    const familiares  = await repo.obtenerTokensFamiliares(datos.id_paciente);
    const tokenMedico = await repo.obtenerTokenMedico(datos.id_paciente);
    const tokens      = [...familiares.map(f => f.token), tokenMedico].filter(Boolean);
    await enviarMulticast(tokens,
      `🚨 URGENTE — MedAlert`,
      `${datos.nombre_paciente} no ha confirmado ${datos.medicamento} en 30 minutos`,
      { id_toma: String(toma.id), nivel: '3', urgente: 'true', id_paciente: String(datos.id_paciente) }
    );
    console.log(`[Escalamiento] Nivel 3 → toma ${toma.id} — ${tokens.length} token(s)`);
    await repo.actualizarNivel(toma.id, 3);
    await repo.registrarAlerta(toma.id, 3);
  }

  // ── Nivel 3 → omitida (> 60 min) ───────────────────────────────
  const nivel3 = await repo.obtenerTomasPendientesParaEscalar(60, null, 3);
  for (const toma of nivel3) {
    await repo.marcarOmitida(toma.id);
    console.log(`[Escalamiento] Omitida → toma ${toma.id}`);
  }
}

module.exports = { registrarToken, checkEscalamiento, enviarNotificacion };
