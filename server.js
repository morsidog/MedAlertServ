// server.js
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
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/arduino',      require('./routes/arduino'));
app.use('/api/pacientes',    require('./routes/pacientes'));
app.use('/api/medicamentos', require('./routes/medicamentos'));
app.use('/api/horarios',     require('./routes/horarios'));
app.use('/api/tomas',        require('./routes/tomas'));
app.use('/api/usuarios',     require('./routes/usuarios'));   // ← FCM token

// ── Error handler ─────────────────────────────────────────────────
app.use(require('./middlewares/errorHandler'));

// ── Cron ──────────────────────────────────────────────────────────
require('./cron');

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});