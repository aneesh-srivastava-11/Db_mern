const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const requestIdMiddleware = require('./middlewares/requestId.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const createError = require('http-errors');

const apiRoutes = require('./routes/api');

const app = express();

// Security: Enforce JSON and UrlEncoded body limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(cors());

// Attach Request Correlation ID before logging
app.use(requestIdMiddleware);

app.use(pinoHttp({ 
    logger,
    genReqId: (req) => req.id,
    serializers: {
        req(req) {
            return {
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
                headers: {
                    host: req.headers.host,
                    'user-agent': req.headers['user-agent'],
                    'x-tenant-id': req.headers['x-tenant-id']
                }
            };
        },
        res(res) {
            return {
                statusCode: res.statusCode
            };
        }
    }
}));

// Routes
app.use('/api/v1', apiRoutes);

// 404 handler
app.use((req, res, next) => {
    next(createError(404, 'Endpoint not found'));
});

// Error handler
app.use(errorMiddleware);

module.exports = app;
