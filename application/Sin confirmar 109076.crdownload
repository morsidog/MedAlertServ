// application/authService.js
const authRepository = require('../infrastructure/authRepository');

// Mapeo de rol (string) a tipo (número en tabla tipos_cuenta)
// DB real: 1=usuario/admin, 2=paciente, 3=medico, 4=familiar
const ROLES_PUBLICOS = { admin: 1, paciente: 2, medico: 3, familiar: 4 };

async function registrarse(nombre, correo, contraseña, rol = 'paciente') {
  if (!nombre || !correo || !contraseña) {
    throw { status: 400, message: 'Nombre, correo y contraseña son obligatorios' };
  }
  // Si llega un número (desde la app Android que envía { tipo: 4 }),
  // usarlo directamente; si llega string (desde la web), mapearlo.
  let tipo;
  if (typeof rol === 'number' || (typeof rol === 'string' && /^\d+$/.test(rol))) {
    tipo = parseInt(rol);
    if (![1, 2, 3, 4].includes(tipo)) tipo = 2; // fallback paciente
  } else {
    tipo = ROLES_PUBLICOS[rol] ?? 2;
  }
  return await authRepository.crear(nombre, correo, contraseña, tipo);
}

async function iniciarSesion(correo, contraseña) {
  if (!correo || !contraseña) {
    throw { status: 400, message: 'Correo y contraseña son obligatorios' };
  }
  return await authRepository.buscarPorCredenciales(correo, contraseña);
}

module.exports = { registrarse, iniciarSesion };
