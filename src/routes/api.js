const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const collectionController = require('../controllers/collection.controller');
const recordController = require('../controllers/record.controller');
const auditController = require('../controllers/audit.controller');
const healthController = require('../controllers/health.controller');

const authMiddleware = require('../middlewares/auth.middleware');
const checkCollectionPermission = require('../middlewares/permission.middleware');
const { createRateLimiter } = require('../services/rateLimiter.service');

const router = express.Router();

// Rate Limiters definition
const collectionLimiter = createRateLimiter('collection', 60000, 60);
const recordLimiter = createRateLimiter('record', 60000, 200);
const auditLimiter = createRateLimiter('audit', 60000, 30);

// Health & Readiness (Public endpoints)
router.get('/health', asyncHandler(healthController.health.bind(healthController)));
router.get('/ready', asyncHandler(healthController.ready.bind(healthController)));

// Enforce Auth and Tenant identification context for all subsequent endpoints
router.use(authMiddleware);

// Collections Management
router.post('/collections', collectionLimiter, asyncHandler(collectionController.create.bind(collectionController)));
router.get('/collections', collectionLimiter, asyncHandler(collectionController.list.bind(collectionController)));
router.patch('/collections/:name', collectionLimiter, asyncHandler(collectionController.update.bind(collectionController)));
router.get('/collections/:name/metadata', collectionLimiter, asyncHandler(collectionController.getMetadata.bind(collectionController)));

// Generic Records CRUD & soft delete / restore
router.post('/records/:collection', recordLimiter, checkCollectionPermission('write'), asyncHandler(recordController.create.bind(recordController)));
router.get('/records/:collection', recordLimiter, checkCollectionPermission('read'), asyncHandler(recordController.list.bind(recordController)));
router.patch('/records/:collection/:id', recordLimiter, checkCollectionPermission('write'), asyncHandler(recordController.update.bind(recordController)));
router.delete('/records/:collection/:id', recordLimiter, checkCollectionPermission('delete'), asyncHandler(recordController.delete.bind(recordController)));
router.post('/records/:collection/:id/restore', recordLimiter, checkCollectionPermission('delete'), asyncHandler(recordController.restore.bind(recordController)));
router.delete('/records/:collection/:id/permanent', recordLimiter, checkCollectionPermission('delete'), asyncHandler(recordController.deletePermanent.bind(recordController)));

// Audit Logs (Admins only)
router.get('/audit', auditLimiter, asyncHandler(auditController.listLogs.bind(auditController)));

module.exports = router;
