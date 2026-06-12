// routes/pacientes.js
const express                       = require('express');
const router                        = express.Router();
const pacienteService               = require('../application/pacienteService');
const { verificarToken, soloRoles } = require('../middlewares/auth');
const db                            = require('../db/database');

router.use(verificarToken);

// ── Middleware: verificar acceso a un paciente específico ─────────
async function verificarAcceso(req, res, next) {
  try {
    const [rows] = await db.query(
      'CALL puede_ver_paciente(?, ?)',
      [req.usuario.id, req.params.id]
    );
    if (!rows[0][0]?.permitido) {
      return res.status(403).json({ ok: false, error: 'Sin acceso a este paciente' });
    }
    next();
  } catch (err) { next(err); }
}

// GET /api/pacientes — médico ve sus pacientes, paciente/familiar ve los suyos
router.get('/', async (req, res, next) => {
  try {
    const { rol, id } = req.usuario;
    let pacientes;

    if (['medico', 'admin'].includes(rol)) {
      const [rows] = await db.query('CALL obtener_pacientes_medico(?)', [id]);
      pacientes = rows[0];
    } else if (rol === 'paciente') {
      // Paciente ve solo su propio registro
      const [rows] = await db.query(
        `SELECT p.id, p.nombre, p.fecha_nacimiento, p.diagnostico, p.dispositivo_id
           FROM pacientes p
           JOIN cuentas c ON c.id_paciente = p.id
          WHERE c.id = ?`,
        [id]
      );
      pacientes = rows;
    } else if (rol === 'familiar') {
      // Familiar ve los pacientes a los que está vinculado
      const [rows] = await db.query(
        `SELECT p.id, p.nombre, p.fecha_nacimiento, p.diagnostico, p.dispositivo_id
           FROM pacientes p
           JOIN familiares_paciente fp ON fp.id_paciente = p.id
          WHERE fp.id_familiar = ? AND p.activo = 1`,
        [id]
      );
      pacientes = rows;
    }

    res.json({ ok: true, pacientes: pacientes ?? [] });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id — con control de acceso
router.get('/:id', verificarAcceso, async (req, res, next) => {
  try {
    const paciente = await pacienteService.obtenerPaciente(req.params.id);
    res.json({ ok: true, paciente });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id/historial — con control de acceso
router.get('/:id/historial', verificarAcceso, async (req, res, next) => {
  try {
    const { desde, hasta, pagina = 1, por_pagina = 50 } = req.query;
    const desde_f = desde || new Date(Date.now() - 7*86400000).toISOString().split('T')[0];
    const hasta_f = hasta || new Date().toISOString().split('T')[0];
    const [rows] = await db.query(
      'CALL obtener_historial(?, ?, ?, ?, ?)',
      [req.params.id, desde_f, hasta_f, parseInt(pagina), parseInt(por_pagina)]
    );
    res.json({ ok: true, tomas: rows[0] ?? [] });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id/adherencia
router.get('/:id/adherencia', verificarAcceso, async (req, res, next) => {
  try {
    const semanas = parseInt(req.query.semanas ?? 4);
    const [rows]  = await db.query('CALL calcular_adherencia(?, ?)', [req.params.id, semanas]);
    res.json({ ok: true, adherencia: rows[0] ?? [] });
  } catch (err) { next(err); }
});

// GET /api/pacientes/:id/familiares — médico ve familiares de un paciente
router.get('/:id/familiares', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const [rows] = await db.query('CALL obtener_familiares_paciente(?)', [req.params.id]);
    res.json({ ok: true, familiares: rows[0] ?? [] });
  } catch (err) { next(err); }
});

// POST /api/pacientes — médico/admin crea paciente
router.post('/', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const paciente = await pacienteService.crearPaciente(req.body, req.usuario.id);
    res.status(201).json({ ok: true, paciente });
  } catch (err) { next(err); }
});

// POST /api/pacientes/:id/cuenta — médico crea cuenta para el paciente
router.post('/:id/cuenta', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const { nombre, correo, contraseña } = req.body;
    if (!nombre || !correo || !contraseña) {
      return res.status(400).json({ ok: false, error: 'nombre, correo y contraseña son obligatorios' });
    }
    const [rows] = await db.query(
      'CALL crear_cuenta_paciente(?, ?, ?, ?)',
      [nombre, correo, contraseña, req.params.id]
    );
    res.status(201).json({ ok: true, cuenta: rows[0][0] });
  } catch (err) {
    if (err.sqlState === '45000') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

// POST /api/pacientes/:id/vincular-cuenta — médico vincula cuenta existente
router.post('/:id/vincular-cuenta', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ ok: false, error: 'correo es obligatorio' });
    const [rows] = await db.query('CALL vincular_cuenta_paciente(?, ?)', [correo, req.params.id]);
    res.json({ ok: true, cuenta: rows[0][0] });
  } catch (err) {
    if (err.sqlState === '45000') return res.status(404).json({ ok: false, error: err.message });
    next(err);
  }
});

// POST /api/pacientes/:id/familiares — médico vincula familiar
router.post('/:id/familiares', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const { correo, es_principal = false } = req.body;
    if (!correo) return res.status(400).json({ ok: false, error: 'correo es obligatorio' });
    const [rows] = await db.query(
      'CALL vincular_familiar(?, ?, ?)',
      [correo, req.params.id, es_principal ? 1 : 0]
    );
    res.status(201).json({ ok: true, familiar: rows[0][0] });
  } catch (err) {
    if (err.sqlState === '45000') return res.status(400).json({ ok: false, error: err.message });
    next(err);
  }
});

// DELETE /api/pacientes/:id/familiares/:id_familiar — médico desvincula familiar
router.delete('/:id/familiares/:id_familiar', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    await db.query('CALL desvincular_familiar(?, ?)', [req.params.id_familiar, req.params.id]);
    res.json({ ok: true, mensaje: 'Familiar desvinculado' });
  } catch (err) { next(err); }
});

// PUT /api/pacientes/:id
router.put('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const paciente = await pacienteService.actualizarPaciente(req.params.id, req.body);
    res.json({ ok: true, paciente });
  } catch (err) { next(err); }
});

// DELETE /api/pacientes/:id
router.delete('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    await pacienteService.desactivarPaciente(req.params.id);
    res.json({ ok: true, mensaje: 'Paciente desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
