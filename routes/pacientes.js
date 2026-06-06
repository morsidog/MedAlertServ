// routes/pacientes.js
const express                       = require('express');
const router                        = express.Router();
const pacienteService               = require('../application/pacienteService');
const { verificarToken, soloRoles } = require('../middlewares/auth');
const db                            = require('../db/database');

router.use(verificarToken);

// GET /api/pacientes — solo médico/admin
router.get('/', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const pacientes = await pacienteService.obtenerPacientes(req.usuario.id);
    res.json({ ok: true, pacientes });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id/historial — todos los roles autenticados
router.get('/:id/historial', async (req, res, next) => {
  try {
    const { id }        = req.params;
    const { desde, hasta, pagina = 1, por_pagina = 50 } = req.query;

    const desde_f  = desde  || new Date(Date.now() - 7*86400000).toISOString().split('T')[0];
    const hasta_f  = hasta  || new Date().toISOString().split('T')[0];

    const [rows] = await db.query(
      'CALL obtener_historial(?, ?, ?, ?, ?)',
      [id, desde_f, hasta_f, parseInt(pagina), parseInt(por_pagina)]
    );
    res.json({ ok: true, tomas: rows[0] ?? [] });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id/adherencia — médico/admin/familiar
router.get('/:id/adherencia', soloRoles('medico','admin','familiar'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const semanas = parseInt(req.query.semanas ?? 4);
    const [rows] = await db.query('CALL calcular_adherencia(?, ?)', [id, semanas]);
    res.json({ ok: true, adherencia: rows[0] ?? [] });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id — médico/admin
router.get('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const paciente = await pacienteService.obtenerPaciente(req.params.id);
    res.json({ ok: true, paciente });
  } catch (err) { next(err); }
});

// POST /api/pacientes — médico/admin
router.post('/', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const paciente = await pacienteService.crearPaciente(req.body, req.usuario.id);
    res.status(201).json({ ok: true, paciente });
  } catch (err) { next(err); }
});

// PUT /api/pacientes/:id — médico/admin
router.put('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const paciente = await pacienteService.actualizarPaciente(req.params.id, req.body);
    res.json({ ok: true, paciente });
  } catch (err) { next(err); }
});

// DELETE /api/pacientes/:id — médico/admin
router.delete('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    await pacienteService.desactivarPaciente(req.params.id);
    res.json({ ok: true, mensaje: 'Paciente desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
