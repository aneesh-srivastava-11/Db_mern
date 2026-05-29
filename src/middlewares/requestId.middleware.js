const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
    const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
    req.id = correlationId; // Used by pino-http
    res.setHeader('X-Request-Id', correlationId);
    next();
};

module.exports = requestIdMiddleware;
