function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${new Date().toISOString()}] ${status} ${message}`, err.stack);
  }

  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal Server Error' : message,
      ...(process.env.NODE_ENV === 'development' && status === 500 && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
