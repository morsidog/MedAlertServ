const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 3000;
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', require('./routes/auth'));

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});

