const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default || require('rate-limit-redis');
const Redis = require('ioredis');
const env = require('../config/env');
const logger = require('../utils/logger');

let redisClient = null;
let isRedisConnected = false;

if (env.REDIS_URL) {
    try {
        redisClient = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: 1,
            retryStrategy(times) {
                // Try reconnecting after 2 seconds, but don't block
                return 2000;
            }
        });

        redisClient.on('connect', () => {
            isRedisConnected = true;
            logger.info('Connected to Redis for rate limiting');
        });

        redisClient.on('error', (err) => {
            if (isRedisConnected) {
                logger.error({ err }, 'Redis connection error, falling back to memory rate limiting');
            }
            isRedisConnected = false;
        });

        redisClient.on('end', () => {
            isRedisConnected = false;
        });
    } catch (error) {
        logger.error({ err: error }, 'Failed to initialize Redis client, falling back to memory rate limiting');
    }
}

/**
 * Creates a rate limiter middleware.
 * @param {string} endpointType - 'collection' or 'record'
 * @param {number} windowMs - time window in milliseconds (default: 1 minute)
 * @param {number} maxRequests - max requests per window
 */
function createRateLimiter(endpointType, windowMs = 60000, maxRequests = 100) {
    // Custom key generator that is tenant-aware
    const keyGenerator = (req) => {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'unknown-tenant';
        const userId = req.user?.userId || 'anonymous';
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
        return `rate-limit:${endpointType}:${tenantId}:${userId}:${ip}`;
    };

    // Custom limit handler to log hits and return structured error
    const handler = (req, res, next, options) => {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'unknown-tenant';
        const userId = req.user?.userId || 'anonymous';
        
        logger.warn({
            tenantId,
            userId,
            endpointType,
            path: req.originalUrl,
            ip: req.ip
        }, 'Rate limit exceeded');

        res.status(429).json({
            success: false,
            error: {
                message: 'Too many requests, please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000)
            }
        });
    };

    // Return the express-rate-limit middleware
    return rateLimit({
        windowMs,
        max: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler,
        store: isRedisConnected && redisClient
            ? new RedisStore({
                sendCommand: async (...args) => {
                    if (!isRedisConnected) {
                        // Fallback to local memory limiter behavior inside store
                        throw new Error('Redis disconnected');
                    }
                    return redisClient.call(...args);
                }
            })
            : undefined // Defaults to MemoryStore if undefined
    });
}

module.exports = {
    createRateLimiter,
    getRedisClient: () => redisClient,
    isRedisConnected: () => isRedisConnected
};
