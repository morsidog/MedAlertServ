// application/horarioService.js
const horarioRepository = require('../infrastructure/horarioRepository');

const DIAS_VALIDOS = [1, 2, 3, 4, 5, 6, 7];

async function crearHorario(datos) {
  const { id_paciente, id_medicamento, hora, compartimento } = datos;
  const esIndividual = !!datos.fecha_especifica;

  // Validaciones comunes
  if (!id_paciente || !id_medicamento || !hora || !compartimento) {
    throw { status: 400, message: 'id_paciente, id_medicamento, hora y compartimento son obligatorios' };
  }
  if (!/^\d{2}:\d{2}$/.test(hora)) {
    throw { status: 400, message: 'hora debe tener formato HH:MM' };
  }
  const comp = Number(compartimento);
  if (comp < 1 || comp > 4) {
    throw { status: 400, message: 'compartimento debe ser 1, 2, 3 o 4' };
  }

  let dias           = null;
  let fecha_especifica = null;
  let una_sola_vez   = 0;

  if (esIndividual) {
    // ── Toma individual ──────────────────────────────────────────
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_especifica)) {
      throw { status: 400, message: 'fecha_especifica debe tener formato YYYY-MM-DD' };
    }
    if (new Date(datos.fecha_especifica) < new Date(new Date().toDateString())) {
      throw { status: 400, message: 'fecha_especifica no puede ser en el pasado' };
    }
    fecha_especifica = datos.fecha_especifica;
    una_sola_vez     = 1;
    dias             = '';
  } else {
    // ── Rutina ───────────────────────────────────────────────────
    if (!datos.dias) {
      throw { status: 400, message: 'dias es obligatorio para una rutina' };
    }
    const diasArray = String(datos.dias).split(',').map(Number);
    if (diasArray.some(d => !DIAS_VALIDOS.includes(d))) {
      throw { status: 400, message: 'dias debe ser una lista del 1 (lun) al 7 (dom), ej: "1,2,3"' };
    }
    dias = String(datos.dias);

    // Verificar conflicto de compartimento (solo rutinas)
    const conflicto = await horarioRepository.verificarConflicto(
      id_paciente, comp, `${hora}:00`, dias
    );
    if (conflicto) {
      throw { status: 409, message: `El compartimento ${comp} ya tiene una rutina a las ${hora} ese día` };
    }
  }

  return horarioRepository.crear(
    id_paciente, id_medicamento, `${hora}:00`,
    dias, comp, fecha_especifica, una_sola_vez
  );
}

async function obtenerHorarios(id_paciente) {
  if (!id_paciente) throw { status: 400, message: 'id_paciente es obligatorio' };
  const horarios = await horarioRepository.obtenerPorPaciente(id_paciente);
  return horarios.map(h => ({
    ...h,
    dias:          h.fecha_especifica ? [] : String(h.dias).split(',').map(Number),
    una_sola_vez:  !!h.una_sola_vez,
    tipo:          h.una_sola_vez ? 'individual' : 'rutina',
  }));
}

async function obtenerHorario(id) {
  const h = await horarioRepository.obtenerPorId(id);
  if (!h) throw { status: 404, message: 'Horario no encontrado' };
  return {
    ...h,
    dias:         h.fecha_especifica ? [] : String(h.dias).split(',').map(Number),
    una_sola_vez: !!h.una_sola_vez,
    tipo:         h.una_sola_vez ? 'individual' : 'rutina',
  };
}

async function desactivarHorario(id) {
  await obtenerHorario(id);
  await horarioRepository.desactivar(id);
}

async function activarHorario(id) {
  await obtenerHorario(id);
  await horarioRepository.activar(id);
}

module.exports = { crearHorario, obtenerHorarios, obtenerHorario, desactivarHorario, activarHorario };
