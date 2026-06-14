/**
 * A wrapper utility that resolves async route handler promises and forwards
 * any uncaught exceptions to the global Express error-handling middleware.
 * 
 * @param {Function} fn - The asynchronous middleware function to wrap
 * @returns {Function} Express route handler with error catch behavior
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (typeof next === 'function') {
      next(err);
    } else {
      console.error('Error in async handler, but next is not available:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    }
  });
};

export default asyncHandler;
