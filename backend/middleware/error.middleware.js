/**
 * Global Error Handler Middleware
 * Catches all errors forwarded by next(err) from controllers
 */
export const errorHandler = (err, req, res, next) => {
  // If the status code is still 200 (OK), force it to 500 (Server Error)
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Bad input caught by the schema is the client's mistake, not a server error.
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(' ');
  } else if (err.code === 11000) {
    statusCode = 400;
    message = 'That value is already in use.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Hide the stack trace if we are in production for security
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};