/**
 * Global Error Handler Middleware
 * Catches all errors forwarded by next(err) from controllers
 */
export const errorHandler = (err, req, res, next) => {
  // If the status code is still 200 (OK), force it to 500 (Server Error)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Hide the stack trace if we are in production for security
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};