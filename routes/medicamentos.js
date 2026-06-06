// routes/medicamentos.js
const express                       = require('express');
const router                        = express.Router();
const medicamentoService            = require('../application/medicamentoService');
const { verificarToken, soloRoles } = require('../middlewares/auth');

router.use(verificarToken);

// GET /api/medicamentos — cualquier usuario autenticado puede listar
router.get('/', async (req, res, next) => {
  try {
    const medicamentos = await medicamentoService.obtenerMedicamentos();
    res.json({ ok: true, medicamentos });
  } catch (err) { next(err); }
});

// GET /api/medicamentos/:id
router.get('/:id', async (req, res, next) => {
  try {
    const medicamento = await medicamentoService.obtenerMedicamento(req.params.id);
    res.json({ ok: true, medicamento });
  } catch (err) { next(err); }
});

// POST /api/medicamentos — solo médico o admin
router.post('/', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const medicamento = await medicamentoService.crearMedicamento(req.body, req.usuario.id);
    res.status(201).json({ ok: true, medicamento });
  } catch (err) { next(err); }
});

// PUT /api/medicamentos/:id
router.put('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    const medicamento = await medicamentoService.actualizarMedicamento(req.params.id, req.body);
    res.json({ ok: true, medicamento });
  } catch (err) { next(err); }
});

// DELETE /api/medicamentos/:id
router.delete('/:id', soloRoles('medico', 'admin'), async (req, res, next) => {
  try {
    await medicamentoService.eliminarMedicamento(req.params.id);
    res.json({ ok: true, mensaje: 'Medicamento eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
