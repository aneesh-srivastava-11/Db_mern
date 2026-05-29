const { z } = require('zod');
const createError = require('http-errors');
const collectionRepo = require('../repositories/collection.repository');
const indexManager = require('../services/indexManager.service');
const auditService = require('../services/audit.service');

const createCollectionSchema = z.object({
    name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    schema: z.record(z.any()).optional(),
    validationEnabled: z.boolean().optional().default(false),
    permissions: z.object({
        read: z.array(z.string()).optional(),
        write: z.array(z.string()).optional(),
        delete: z.array(z.string()).optional()
    }).optional(),
    indexes: z.array(z.string()).optional()
});

const updateCollectionSchema = z.object({
    schema: z.record(z.any()).optional(),
    validationEnabled: z.boolean().optional(),
    permissions: z.object({
        read: z.array(z.string()).optional(),
        write: z.array(z.string()).optional(),
        delete: z.array(z.string()).optional()
    }).optional(),
    indexes: z.array(z.string()).optional()
});

class CollectionController {
    async create(req, res) {
        const { tenantId, userId } = req.user;
        const validatedData = createCollectionSchema.parse(req.body);

        const collection = await collectionRepo.createCollection(
            tenantId,
            validatedData.name,
            validatedData.schema,
            validatedData.validationEnabled,
            validatedData.permissions,
            validatedData.indexes
        );

        // Sync indexes in background if defined
        if (validatedData.indexes && validatedData.indexes.length > 0) {
            indexManager.syncIndexes(tenantId, validatedData.name, validatedData.indexes);
        }

        // Write non-blocking audit log
        auditService.log(tenantId, userId, 'USER_CREATED_COLLECTION', collection.id, null, { name: collection.name });

        res.status(201).json({ success: true, data: collection });
    }

    async update(req, res) {
        const { tenantId, userId } = req.user;
        const { name } = req.params;
        const validatedData = updateCollectionSchema.parse(req.body);

        const collection = await collectionRepo.updateCollection(tenantId, name, validatedData);

        // Sync indexes in background if updated
        if (validatedData.indexes && validatedData.indexes.length > 0) {
            indexManager.syncIndexes(tenantId, name, validatedData.indexes);
        }

        // Write non-blocking audit log
        auditService.log(tenantId, userId, 'USER_UPDATED_COLLECTION', collection.id, null, { name: collection.name });

        res.status(200).json({ success: true, data: collection });
    }

    async list(req, res) {
        const { tenantId } = req.user;
        const collections = await collectionRepo.listCollections(tenantId);

        res.status(200).json({ success: true, data: collections });
    }

    async getMetadata(req, res) {
        const { tenantId } = req.user;
        const { name } = req.params;

        const metadata = await collectionRepo.getCollectionMetadata(tenantId, name);
        if (!metadata) {
            throw createError(404, `Collection '${name}' not found`);
        }

        res.status(200).json({ success: true, data: metadata });
    }
}

module.exports = new CollectionController();
