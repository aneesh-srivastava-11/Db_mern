const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const env = require('../config/env');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Support public / guest access by checking if a tenant identifier is provided
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        if (tenantId) {
            req.user = {
                tenantId,
                userId: 'anonymous',
                role: 'public'
            };
            return next();
        }
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
