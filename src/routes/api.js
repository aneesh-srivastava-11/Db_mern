const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const collectionController = require('../controllers/collection.controller');
const recordController = require('../controllers/record.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// Health check
router.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Require auth for all subsequent API routes
router.use(authMiddleware);

// Collections
router.post('/collections', asyncHandler(collectionController.create.bind(collectionController)));
router.get('/collections', asyncHandler(collectionController.list.bind(collectionController)));

// Records
router.post('/records/:collection', asyncHandler(recordController.create.bind(recordController)));
router.get('/records/:collection', asyncHandler(recordController.list.bind(recordController)));
router.patch('/records/:collection/:id', asyncHandler(recordController.update.bind(recordController)));
router.delete('/records/:collection/:id', asyncHandler(recordController.delete.bind(recordController)));

module.exports = router;
