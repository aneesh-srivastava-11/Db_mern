const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const prisma = require('./config/db');

async function startServer() {
    try {
        // Attempt DB connection
        await prisma.$connect();
        logger.info('Connected to MongoDB via Prisma');

        const server = app.listen(env.PORT, () => {
            logger.info(`🚀 Data Storage Service running at http://localhost:${env.PORT}/api/v1`);
        });

        const gracefulShutdown = async () => {
            logger.info('Shutting down server gracefully...');
            server.close();
            await prisma.$disconnect();
            process.exit(0);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
}

startServer();
