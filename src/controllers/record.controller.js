const createError = require('http-errors');
const recordRepo = require('../repositories/record.repository');
const collectionRepo = require('../repositories/collection.repository');
const validatorService = require('../services/validator.service');
const auditService = require('../services/audit.service');

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

        const coll = await this._verifyCollection(tenantId, collection);

        // Dynamic Schema Validation
        if (coll.validationEnabled && coll.schema) {
            validatorService.validate(coll.schema, data);
        }

        const record = await recordRepo.createRecord(tenantId, collection, userId, data);
        
        // Non-blocking Audit Logging
        auditService.log(tenantId, userId, 'USER_CREATED_RECORD', coll.id, record.id, { collection });

        res.status(201).json({ success: true, data: record });
    }

    async list(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection } = req.params;
        const { page, limit, filter, sort, search, fields, includeDeleted } = req.query;

        const coll = await this._verifyCollection(tenantId, collection);

        // Only admin role bypasses ownership constraints
        const ownerId = role === 'admin' ? null : userId;

        // Parse includeDeleted flag
        const isIncludeDeleted = includeDeleted === 'true';

        const result = await recordRepo.findRecords(tenantId, collection, ownerId, {
            page,
            limit,
            filter,
            sort,
            search,
            fields,
            includeDeleted: isIncludeDeleted
        });

        res.status(200).json({ success: true, ...result });
    }

    async update(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection, id } = req.params;
        const updateData = req.body;

        const coll = await this._verifyCollection(tenantId, collection);

        const ownerId = role === 'admin' ? null : userId;

        // Fetch existing record first for merge validation
        const existing = await recordRepo.getRecordById(id, tenantId, collection, ownerId);
        if (!existing) {
            throw createError(404, 'Record not found or you do not have permission to modify it');
        }

        // Merge existing and new payload for validation
        const mergedData = (typeof existing.data === 'object' && typeof updateData === 'object')
            ? { ...existing.data, ...updateData }
            : updateData;

        // Dynamic Schema Validation
        if (coll.validationEnabled && coll.schema) {
            validatorService.validate(coll.schema, mergedData);
        }

        const record = await recordRepo.updateRecord(id, tenantId, collection, ownerId, updateData);

        // Non-blocking Audit Logging
        auditService.log(tenantId, userId, 'USER_UPDATED_RECORD', coll.id, id, { collection });

        res.status(200).json({ success: true, data: record });
    }

    async delete(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection, id } = req.params;

        const coll = await this._verifyCollection(tenantId, collection);

        const ownerId = role === 'admin' ? null : userId;

        const record = await recordRepo.deleteRecord(id, tenantId, collection, ownerId);

        if (!record) {
            throw createError(404, 'Record not found or you do not have permission to delete it');
        }

        // Non-blocking Audit Logging
        auditService.log(tenantId, userId, 'USER_DELETED_RECORD', coll.id, id, { collection });

        res.status(200).json({ success: true, message: 'Record deleted' });
    }

    async restore(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection, id } = req.params;

        const coll = await this._verifyCollection(tenantId, collection);

        const ownerId = role === 'admin' ? null : userId;

        const record = await recordRepo.restoreRecord(id, tenantId, collection, ownerId);

        if (!record) {
            throw createError(404, 'Record not found, not deleted, or you do not have permission to restore it');
        }

        // Non-blocking Audit Logging
        auditService.log(tenantId, userId, 'USER_RESTORED_RECORD', coll.id, id, { collection });

        res.status(200).json({ success: true, data: record, message: 'Record restored' });
    }

    async deletePermanent(req, res) {
        const { tenantId, userId, role } = req.user;
        const { collection, id } = req.params;

        const coll = await this._verifyCollection(tenantId, collection);

        const ownerId = role === 'admin' ? null : userId;

        const record = await recordRepo.deleteRecordPermanent(id, tenantId, collection, ownerId);

        if (!record) {
            throw createError(404, 'Record not found or you do not have permission to permanently delete it');
        }

        // Non-blocking Audit Logging
        auditService.log(tenantId, userId, 'USER_PERMANENTLY_DELETED_RECORD', coll.id, id, { collection });

        res.status(200).json({ success: true, message: 'Record permanently deleted' });
    }
}

module.exports = new RecordController();
