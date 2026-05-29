const { ZodError } = require('zod');
const logger = require('../utils/logger');
const env = require('../config/env');

const errorMiddleware = (err, req, res, next) => {
    let statusCode = err.status || err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let details = err.errors;

    // Handle Zod Validation Errors
    if (err instanceof ZodError) {
        statusCode = 400;
        message = 'Validation Failed';
        details = err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
        }));
    }

    if (statusCode === 500) {
        logger.error({
            err,
            requestId: req.id,
            tenantId: req.user?.tenantId,
            userId: req.user?.userId,
            path: req.originalUrl,
            method: req.method
        }, 'Unhandled Exception');
    } else {
        logger.warn({
            message,
            statusCode,
            requestId: req.id,
            tenantId: req.user?.tenantId,
            path: req.originalUrl,
            method: req.method,
            details
        }, 'Request Request Error');
    }

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            ...(details && { details }),
            ...(env.NODE_ENV === 'development' && { stack: err.stack }),
            requestId: req.id
        }
    });
};

module.exports = errorMiddleware;
