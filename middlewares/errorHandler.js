// middlewares/errorHandler.js  (HU-45)
const { randomUUID } = require('crypto');

module.exports = function errorHandler(err, req, res, next) {
  const requestId = randomUUID().split('-')[0].toUpperCase();

  // Errores con status explícito (lanzados desde servicios)
  if (err.status) {
    return res.status(err.status).json({
      ok:    false,
      error: err.message,
    });
  }

  // Error 500 no controlado
  console.error(`[${requestId}] Error no controlado:`, err.message, err.stack);

  res.status(500).json({
    ok:        false,
    error:     'Error interno del servidor',
    code:      `ERR_${requestId}`,
    requestId,
  });
};
