const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const env = require('../config/env');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(createError(401, 'Unauthorized: Missing or invalid token'));
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // We expect the identity service to encode tenantId and userId (or sub)
        if (!decoded.tenantId || (!decoded.userId && !decoded.sub)) {
            return next(createError(401, 'Unauthorized: Token missing tenant or user context'));
        }

        req.user = {
            tenantId: decoded.tenantId,
            userId: decoded.userId || decoded.sub,
            role: decoded.role || 'user'
        };

        next();
    } catch (error) {
        logger.error({ err: error }, 'JWT Verification Failed');
        return next(createError(401, 'Unauthorized: Invalid token'));
    }
};

module.exports = authMiddleware;
