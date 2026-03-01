const { z } = require('zod');
const createError = require('http-errors');
const collectionRepo = require('../repositories/collection.repository');

const createCollectionSchema = z.object({
    name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    schema: z.record(z.any()).optional()
});

class CollectionController {
    async create(req, res) {
        const { tenantId } = req.user;
        const validatedData = createCollectionSchema.parse(req.body);

        const collection = await collectionRepo.createCollection(
            tenantId,
            validatedData.name,
            validatedData.schema
        );

        res.status(201).json({ success: true, data: collection });
    }

    async list(req, res) {
        const { tenantId } = req.user;
        const collections = await collectionRepo.listCollections(tenantId);

        res.status(200).json({ success: true, data: collections });
    }
}

module.exports = new CollectionController();
