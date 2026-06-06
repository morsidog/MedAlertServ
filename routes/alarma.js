const express = require('express');
const router = express.Router();
const alarmaService = require('../application/alarmaService');

router.post('/alarma', async (req, res,next) => {
  try {
    const { id_paciente, medicina, configuracion } = req.body;
    const alarma = await alarmaService.crearAlarma(id_paciente, medicina, configuracion);
    res.status(201).json({ ok: true, alarma });
  } catch (err) {
    next(err);
  }
});

router.get('/alarmas/:id_paciente', async (req, res,next) => {
  try {
    const { id_paciente } = req.params;
    const alarmas = await alarmaService.obtenerAlarmas(id_paciente);
    res.status(200).json({ ok: true, alarmas });
  } catch (err) {
    next(err);
  }
});

router.get('/registros/:id_paciente', async (req, res,next) => {
  try {
    const { id_paciente } = req.params;
    const registros = await alarmaService.obtenerRegistros(id_paciente);
    res.status(200).json({ ok: true, registros });
  } catch (err) {
    next(err);
  }
});

module.exports = router;