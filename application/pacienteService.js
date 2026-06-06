// application/pacienteService.js
const pacienteRepository = require('../infrastructure/pacienteRepository');

async function crearPaciente(datos, id_medico) {
  const { nombre, fecha_nacimiento, diagnostico, dispositivo_id } = datos;
  if (!nombre || !fecha_nacimiento) {
    throw { status: 400, message: 'nombre y fecha_nacimiento son obligatorios' };
  }
  return pacienteRepository.crear(nombre, fecha_nacimiento, diagnostico, dispositivo_id, id_medico);
}

async function obtenerPacientes(id_medico) {
  return pacienteRepository.obtenerTodos(id_medico);
}

async function obtenerPaciente(id) {
  const paciente = await pacienteRepository.obtenerPorId(id);
  if (!paciente) throw { status: 404, message: 'Paciente no encontrado' };
  return paciente;
}

async function actualizarPaciente(id, campos) {
  await obtenerPaciente(id); // verifica que existe
  return pacienteRepository.actualizar(id, campos);
}

async function desactivarPaciente(id) {
  await obtenerPaciente(id);
  await pacienteRepository.desactivar(id);
}

module.exports = { crearPaciente, obtenerPacientes, obtenerPaciente, actualizarPaciente, desactivarPaciente };
