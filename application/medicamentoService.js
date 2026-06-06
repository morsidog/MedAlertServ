// application/medicamentoService.js
const medicamentoRepository = require('../infrastructure/medicamentoRepository');

async function crearMedicamento(datos, id_cuenta) {
  const { nombre, dosis_mg, instrucciones, color_pastilla } = datos;
  if (!nombre || !dosis_mg) {
    throw { status: 400, message: 'nombre y dosis_mg son obligatorios' };
  }
  if (isNaN(dosis_mg) || Number(dosis_mg) <= 0) {
    throw { status: 400, message: 'dosis_mg debe ser un número positivo' };
  }
  return medicamentoRepository.crear(nombre, Number(dosis_mg), instrucciones, color_pastilla, id_cuenta);
}

async function obtenerMedicamentos() {
  return medicamentoRepository.obtenerTodos();
}

async function obtenerMedicamento(id) {
  const med = await medicamentoRepository.obtenerPorId(id);
  if (!med) throw { status: 404, message: 'Medicamento no encontrado' };
  return med;
}

async function actualizarMedicamento(id, campos) {
  await obtenerMedicamento(id);
  return medicamentoRepository.actualizar(id, campos);
}

async function eliminarMedicamento(id) {
  await obtenerMedicamento(id);
  await medicamentoRepository.eliminar(id);
}

module.exports = { crearMedicamento, obtenerMedicamentos, obtenerMedicamento, actualizarMedicamento, eliminarMedicamento };
