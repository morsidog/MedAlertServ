// routes/horarios.js
const express                       = require('express');
const router                        = express.Router();
const horarioService                = require('../application/horarioService');
const { verificarToken, soloRoles } = require('../middlewares/auth');
const db                            = require('../db/database');

router.use(verificarToken);

// Middleware de acceso a paciente
async function verificarAcceso(req, res, next) {
  try {
    const idPaciente = req.params.id_paciente || req.body.id_paciente;
    if (!idPaciente) return next();
    const [rows] = await db.query(
      'CALL puede_ver_paciente(?, ?)', [req.usuario.id, idPaciente]
    );
    if (!rows[0][0]?.permitido) {
      return res.status(403).json({ ok: false, error: 'Sin acceso a este paciente' });
    }
    next();
  } catch (err) { next(err); }
}

// GET /api/horarios/:id_paciente
router.get('/:id_paciente', verificarAcceso, async (req, res, next) => {
  try {
    const horarios = await horarioService.obtenerHorarios(req.params.id_paciente);
    res.json({ ok: true, horarios });
  } catch (err) { next(err); }
});

// POST /api/horarios — rutina o toma individual
router.post('/', verificarAcceso, async (req, res, next) => {
  try {
    const horario = await horarioService.crearHorario(req.body);
    res.status(201).json({ ok: true, horario });
  } catch (err) { next(err); }
});

// POST /api/horarios/intervalo — alarma cada N minutos
router.post('/intervalo', verificarAcceso, async (req, res, next) => {
  try {
    const { id_paciente, id_medicamento, hora_inicio, intervalo_minutos, compartimento, dias } = req.body;

    if (!id_paciente || !id_medicamento || !hora_inicio || !intervalo_minutos || !compartimento) {
      return res.status(400).json({ ok: false, error: 'id_paciente, id_medicamento, hora_inicio, intervalo_minutos y compartimento son obligatorios' });
    }
    if (intervalo_minutos < 30) {
      return res.status(400).json({ ok: false, error: 'intervalo_minutos mínimo es 30' });
    }

    const diasStr = dias ?? '1,2,3,4,5,6,7';
    const [rows] = await db.query(
      'CALL crear_horario_intervalo(?, ?, ?, ?, ?, ?)',
      [id_paciente, id_medicamento, hora_inicio, intervalo_minutos, compartimento, diasStr]
    );
    res.status(201).json({ ok: true, resultado: rows[0][0] });
  } catch (err) { next(err); }
});

// PATCH /api/horarios/:id/desactivar
router.patch('/:id/desactivar', async (req, res, next) => {
  try {
    await horarioService.desactivarHorario(req.params.id);
    res.json({ ok: true, mensaje: 'Horario desactivado' });
  } catch (err) { next(err); }
});

// PATCH /api/horarios/:id/activar
router.patch('/:id/activar', async (req, res, next) => {
  try {
    await horarioService.activarHorario(req.params.id);
    res.json({ ok: true, mensaje: 'Horario activado' });
  } catch (err) { next(err); }
});

// DELETE /api/horarios/:id — elimina un horario.
// DELETE /api/horarios/:id?grupo=true — si es parte de un intervalo,
// elimina todas las alarmas generadas por ese mismo "cada N horas".
router.delete('/:id', async (req, res, next) => {
  try {
    const grupoCompleto = req.query.grupo === 'true';
    const eliminados = await horarioService.eliminarHorario(req.params.id, grupoCompleto);
    res.json({ ok: true, eliminados, mensaje: 'Horario eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
