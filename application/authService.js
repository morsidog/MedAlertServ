// application/authService.js
const authRepository = require('../infrastructure/authRepository');

const ROLES_PUBLICOS = { medico: 3, paciente: 2, familiar: 4 };

async function registrarse(nombre, correo, contraseña, rol = 'paciente') {
  if (!nombre || !correo || !contraseña) {
    throw { status: 400, message: 'Nombre, correo y contraseña son obligatorios' };
  }
  const tipo = ROLES_PUBLICOS[rol] ?? 3;
  return await authRepository.crear(nombre, correo, contraseña, tipo);
}

async function iniciarSesion(correo, contraseña) {
  if (!correo || !contraseña) {
    throw { status: 400, message: 'Correo y contraseña son obligatorios' };
  }
  return await authRepository.buscarPorCredenciales(correo, contraseña);
}

module.exports = { registrarse, iniciarSesion };
