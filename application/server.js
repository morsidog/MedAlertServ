// server.js

// ── Zona horaria ──────────────────────────────────────────────────
// Forzar America/Mexico_City (Guadalajara, CST/CDT) para que todos los
// new Date() del proceso (cron, validaciones de fecha, logs) usen la
// hora local en vez de UTC. Debe ir ANTES de crear cualquier Date.
process.env.TZ = process.env.TZ || 'America/Mexico_City';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Ruta raíz ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'MedAlert.html'));
});

// ── Rutas API ─────────────────────────────────────────────────────
app.use('/api/health',       require('./routes/health'));       // HU-39
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/arduino',      require('./routes/arduino'));
app.use('/api/pacientes',    require('./routes/pacientes'));
app.use('/api/medicamentos', require('./routes/medicamentos'));
app.use('/api/horarios',     require('./routes/horarios'));
app.use('/api/tomas',        require('./routes/tomas'));
app.use('/api/usuarios',     require('./routes/usuarios'));
app.use('/api/admin',        require('./routes/admin'));        // HU-43

// ── Error handler ─────────────────────────────────────────────────
app.use(require('./middlewares/errorHandler'));

// ── Cron ──────────────────────────────────────────────────────────
require('./cron');

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
