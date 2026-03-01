const createError = require('http-errors');
const recordRepo = require('../repositories/record.repository');
const collectionRepo = require('../repositories/collection.repository');

class RecordController {

    async _verifyCollection(tenantId, name) {
        const coll = await collectionRepo.getCollectionByName(tenantId, name);
        if (!coll) {
            throw createError(404, `Collection '${name}' not found for this tenant`);
        }
        return coll;
    }

    async create(req, res) {
        const { tenantId, userId } = req.user;
        const { collection } = req.params;
        const data = req.body;

        await this._verifyCollection(tenantId, collection);

        const record = await recordRepo.createRecord(tenantId, collection, userId, data);
        res.status(201).json({ success: true, data: record });
    }

    async list(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection } = req.params;
        const { page, limit } = req.query;

        await this._verifyCollection(tenantId, collection);

        // If role is admin, they don't need ownership match; otherwise enforce ownership
        const ownerId = role === 'admin' ? null : userId;

        // Pass query options to repository
        const result = await recordRepo.findRecords(tenantId, collection, ownerId, { page, limit });

        res.status(200).json({ success: true, ...result });
    }

    async update(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection, id } = req.params;
        const updateData = req.body;

        await this._verifyCollection(tenantId, collection);

        const ownerId = role === 'admin' ? null : userId;

        const record = await recordRepo.updateRecord(id, tenantId, collection, ownerId, updateData);

        if (!record) {
            throw createError(404, 'Record not found or you do not have permission to modify it');
        }

        res.status(200).json({ success: true, data: record });
    }

    async delete(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection, id } = req.params;

        await this._verifyCollection(tenantId, collection);

        const ownerId = role === 'admin' ? null : userId;

        const record = await recordRepo.deleteRecord(id, tenantId, collection, ownerId);

        if (!record) {
            throw createError(404, 'Record not found or you do not have permission to delete it');
        }

        res.status(200).json({ success: true, message: 'Record deleted' });
    }
}

module.exports = new RecordController();
