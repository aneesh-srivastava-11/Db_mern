const prisma = require('../config/db');
const logger = require('../utils/logger');

class AuditService {
    /**
     * Log an action in a non-blocking way.
     */
    log(tenantId, userId, action, collectionId = null, recordId = null, metadata = {}) {
        // Run asynchronously, catch errors so it doesn't block the request lifecycle
        prisma.auditLog.create({
            data: {
                tenantId,
                userId,
                action,
                collectionId,
                recordId,
                metadata
            }
        }).catch(err => {
            logger.error({ err, action, tenantId, userId }, 'Failed to write audit log to database');
        });
    }

    /**
     * Retrieve audit logs with pagination (Admin only).
     */
    async getLogs(tenantId, queryOptions = {}) {
        const { page = 1, limit = 20 } = queryOptions;

        const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
        const take = Math.max(1, parseInt(limit));

        const where = { tenantId };

        const [data, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.auditLog.count({ where })
        ]);

        return {
            data,
            meta: {
                total,
                page: parseInt(page),
                limit: take,
                totalPages: Math.ceil(total / take)
            }
        };
    }
}

module.exports = new AuditService();
