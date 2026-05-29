const prisma = require('../config/db');
const { isRedisConnected, getRedisClient } = require('../services/rateLimiter.service');
const env = require('../config/env');

class HealthController {
    async health(req, res) {
        res.status(200).json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    }

    async ready(req, res) {
        const checks = {
            status: 'ready',
            mongo: 'disconnected',
            redis: 'disconnected'
        };

        let isHealthy = true;

        // Verify MongoDB via Prisma
        try {
            await prisma.$runCommandRaw({ ping: 1 });
            checks.mongo = 'connected';
        } catch (error) {
            checks.mongo = 'error';
            checks.status = 'unhealthy';
            isHealthy = false;
        }

        // Verify Redis (if configured)
        if (env.REDIS_URL) {
            try {
                const isConn = isRedisConnected();
                if (isConn) {
                    const client = getRedisClient();
                    if (client) {
                        await client.ping();
                        checks.redis = 'connected';
                    } else {
                        checks.redis = 'error';
                        isHealthy = false;
                    }
                } else {
                    checks.redis = 'disconnected';
                    checks.status = 'unhealthy';
                    isHealthy = false;
                }
            } catch (error) {
                checks.redis = 'error';
                checks.status = 'unhealthy';
                isHealthy = false;
            }
        } else {
            checks.redis = 'not_configured'; // Memory fallback is active, so not blocking readiness
        }

        if (!isHealthy) {
            return res.status(503).json(checks);
        }

        res.status(200).json(checks);
    }
}

module.exports = new HealthController();
