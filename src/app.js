const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const errorMiddleware = require('./middlewares/error.middleware');
const createError = require('http-errors');

const apiRoutes = require('./routes/api');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Routes
app.use('/api/v1', apiRoutes);

// 404 handler
app.use((req, res, next) => {
    next(createError(404, 'Endpoint not found'));
});

// Error handler
app.use(errorMiddleware);

module.exports = app;
