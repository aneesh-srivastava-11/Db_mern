const logger = require('../utils/logger');
const env = require('../config/env');

const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    if (statusCode === 500) {
        logger.error({ err, req }, 'Unhandled Exception');
    }

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            ...(env.NODE_ENV === 'development' && { stack: err.stack }),
            ...(err.errors && { details: err.errors }) // For Zod validation errors
        }
    });
};

module.exports = errorMiddleware;
