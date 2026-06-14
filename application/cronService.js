// application/cronService.js
const cronRepository = require('../infrastructure/cronRepository');

/**
 * Se ejecuta cada minuto.
 * Para cada horario activo verifica si toca disparar ahora:
 *
 * Rutina:         hora == ahora Y día-de-semana está en h.dias
 * Toma individual: hora == ahora Y h.fecha_especifica == fecha de hoy
 */
async function checkHorarios() {
  const ahora   = new Date();
  const horaHoy = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:00`;
  const diaISO  = ahora.getDay() === 0 ? 7 : ahora.getDay(); // 1=lun…7=dom
  // fechaHoy en hora LOCAL (America/Mexico_City vía TZ), no UTC,
  // para que coincida con horaHoy/diaISO cerca de medianoche
  const fechaHoy = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;

  let horarios;
  try {
    horarios = await cronRepository.obtenerHorariosActivos();
  } catch (err) {
    console.error('[Cron] Error obteniendo horarios:', err.message);
    return;
  }

  for (const h of horarios) {
    if (h.hora !== horaHoy) continue;

    // ── Decidir si toca hoy ──────────────────────────────────────
    let esTocaHoy;
    if (h.fecha_especifica) {
      // mysql2 devuelve DATE como objeto Date (medianoche UTC).
      // Extraer la fecha en hora local para comparar correctamente.
      const fe = h.fecha_especifica instanceof Date
        ? `${h.fecha_especifica.getFullYear()}-${pad(h.fecha_especifica.getMonth() + 1)}-${pad(h.fecha_especifica.getDate())}`
        : String(h.fecha_especifica).slice(0, 10);
      esTocaHoy = fe === fechaHoy;
    } else {
      esTocaHoy = String(h.dias).split(',').map(Number).includes(diaISO);
    }

    if (!esTocaHoy) continue;

    if (!h.device_id) {
      console.warn(`[Cron] Horario ${h.id_horario} sin device_id — se omite`);
      continue;
    }

    try {
      // 1. Crear toma (el SP evita duplicados)
      const id_toma = await cronRepository.registrarToma(
        h.id_horario, h.id_paciente, ahora
      );
      if (!id_toma) continue; // ya existía

      // 2. Construir y encolar comando para el ESP32
      const comando = `DISPENSE:${h.compartimento}:${id_toma}:${h.medicamento}:${h.dosis_mg}mg`;
      await cronRepository.encolarComando(h.device_id, id_toma, comando);

      console.log(`[Cron] ✅ Toma ${id_toma} encolada → ${comando}`);

      // 3. Si es toma individual, desactivar el horario
      if (h.una_sola_vez) {
        await cronRepository.desactivarHorario(h.id_horario);
        console.log(`[Cron] 🔕 Horario ${h.id_horario} desactivado (una sola vez)`);
      }

    } catch (err) {
      console.error(`[Cron] ❌ Horario ${h.id_horario}:`, err.message);
    }
  }
}

function pad(n) { return String(n).padStart(2, '0'); }

module.exports = { checkHorarios };
