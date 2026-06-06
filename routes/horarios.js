// routes/horarios.js
const express                       = require('express');
const router                        = express.Router();
const horarioService                = require('../application/horarioService');
const { verificarToken, soloRoles } = require('../middlewares/auth');

router.use(verificarToken, soloRoles('medico', 'admin'));

// GET /api/horarios/:id_paciente — listar horarios de un paciente
router.get('/:id_paciente', async (req, res, next) => {
  try {
    const horarios = await horarioService.obtenerHorarios(req.params.id_paciente);
    res.json({ ok: true, horarios });
  } catch (err) { next(err); }
});

// POST /api/horarios — crear horario
// Body: { id_paciente, id_medicamento, hora:"08:00", dias:"1,2,3,4,5", compartimento:1 }
router.post('/', async (req, res, next) => {
  try {
    const horario = await horarioService.crearHorario(req.body);
    res.status(201).json({ ok: true, horario });
  } catch (err) { next(err); }
});

// PATCH /api/horarios/:id/desactivar — pausar sin borrar
router.patch('/:id/desactivar', async (req, res, next) => {
  try {
    await horarioService.desactivarHorario(req.params.id);
    res.json({ ok: true, mensaje: 'Horario desactivado' });
  } catch (err) { next(err); }
});

// PATCH /api/horarios/:id/activar — reactivar
router.patch('/:id/activar', async (req, res, next) => {
  try {
    await horarioService.activarHorario(req.params.id);
    res.json({ ok: true, mensaje: 'Horario activado' });
  } catch (err) { next(err); }
});

module.exports = router;
