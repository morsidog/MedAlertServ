const alarmaRepository = require('../infrastructure/alarmaRepository');

async function crearAlarma(id_paciente, medicina, configuracion) {
  if (!id_paciente || !medicina) {
    throw { status: 400, message: 'id_paciente y medicina son obligatorios' };
  }
  return await alarmaRepository.crear(id_paciente, medicina, configuracion);
}

async function obtenerAlarmas(id_paciente) {
  if (!id_paciente) {
    throw { status: 400, message: 'id_paciente es obligatorio' };
  }
  return await alarmaRepository.obtenerPorPaciente(id_paciente);
}

async function obtenerRegistros(id_paciente) {
  if (!id_paciente) {
    throw { status: 400, message: 'id_paciente es obligatorio' };
  }
  return await alarmaRepository.obtenerRegistrosPorPaciente(id_paciente);
}

module.exports = { crearAlarma, obtenerAlarmas, obtenerRegistros };