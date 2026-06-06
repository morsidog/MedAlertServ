// db/init.js
// Ejecutar una sola vez: node db/init.js
// Lee init.sql y aplica cada sentencia en orden.

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('./database');

async function init() {
  const sqlFile = path.join(__dirname, 'init.sql');
  const raw     = fs.readFileSync(sqlFile, 'utf8');

  // Dividir en sentencias individuales respetando DELIMITER $$
  const statements = splitStatements(raw);
  let ok = 0;

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    try {
      await db.query(trimmed);
      ok++;
    } catch (err) {
      // Ignorar "ya existe" en INSERT IGNORE / IF NOT EXISTS
      if (err.code === 'ER_TABLE_EXISTS_ERROR') continue;
      console.error(`❌ Error en sentencia:\n${trimmed.substring(0, 120)}...\n→ ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`✅ Init completo — ${ok} sentencias ejecutadas`);
  process.exit(0);
}

/**
 * Divide el SQL en sentencias individuales.
 * Maneja bloques DELIMITER $$ ... $$ correctamente.
 */
function splitStatements(sql) {
  const result = [];
  let delimiter = ';';
  let current   = '';

  for (const line of sql.split('\n')) {
    const trimLine = line.trim();

    // Cambio de DELIMITER
    if (/^DELIMITER\s+(\S+)/i.test(trimLine)) {
      delimiter = trimLine.match(/^DELIMITER\s+(\S+)/i)[1];
      continue;
    }

    current += line + '\n';

    if (current.trimEnd().endsWith(delimiter)) {
      // Quitar el delimiter del final antes de guardar
      result.push(current.trimEnd().slice(0, -delimiter.length));
      current = '';
    }
  }

  if (current.trim()) result.push(current);
  return result;
}

init();
