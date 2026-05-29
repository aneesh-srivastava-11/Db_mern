const prisma = require('../config/db');

function escapeRegex(text) {
    return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function normalizeRawDoc(doc) {
    if (!doc) return null;
    const normalized = { ...doc };

    if (doc._id) {
        if (doc._id.$oid) {
            normalized.id = doc._id.$oid;
        } else {
            normalized.id = doc._id.toString();
        }
        delete normalized._id;
    }

    const dateFields = ['createdAt', 'updatedAt', 'deletedAt'];
    for (const key of dateFields) {
        if (doc[key]) {
            if (doc[key].$date) {
                normalized[key] = new Date(doc[key].$date);
            } else {
                normalized[key] = new Date(doc[key]);
            }
        } else {
            normalized[key] = null;
        }
    }

    return normalized;
}

class RecordRepository {
    async createRecord(tenantId, collection, ownerId, data) {
        return prisma.record.create({
            data: {
                tenantId,
                collection,
                ownerId,
                data,
                deletedAt: null
            }
        });
    }

    async findRecords(tenantId, collection, ownerId = null, queryOptions = {}) {
        const {
            page = 1,
            limit = 10,
            filter,
            sort,
            search,
            fields,
            includeDeleted = false
        } = queryOptions;

        const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
        const take = Math.max(1, parseInt(limit));

        // Build the raw MongoDB filter
        const filterObj = {
            tenantId,
            collection
        };

        // Enforce ownership
        if (ownerId) {
            filterObj.ownerId = ownerId;
        }

        // Handle soft delete filter
        if (!includeDeleted) {
            filterObj.deletedAt = null;
        }

        // Apply filters on data fields
        if (filter && typeof filter === 'object') {
            for (const [key, value] of Object.entries(filter)) {
                // Prevent query injection or malformed keys
                if (key.startsWith('$')) continue;

                const mongoKey = `data.${key}`;
                
                let parsedValue = value;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                else if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);

                filterObj[mongoKey] = parsedValue;
            }
        }

        // Apply search query
        if (search && typeof search === 'string' && search.trim()) {
            const escapedSearch = escapeRegex(search.trim());
            filterObj["$or"] = [
                { "data.title": { "$regex": escapedSearch, "$options": "i" } },
                { "data.content": { "$regex": escapedSearch, "$options": "i" } },
                { "data.description": { "$regex": escapedSearch, "$options": "i" } },
                { "data.name": { "$regex": escapedSearch, "$options": "i" } },
                { "data.email": { "$regex": escapedSearch, "$options": "i" } }
            ];
        }

        // Apply sorting
        const sortObj = {};
        if (sort && typeof sort === 'string') {
            const sortFields = sort.split(',');
            for (const field of sortFields) {
                const desc = field.startsWith('-');
                const name = desc ? field.substring(1) : field;

                // Sort by top level or data fields
                const mongoField = (name === 'createdAt' || name === 'updatedAt' || name === 'deletedAt')
                    ? name
                    : `data.${name}`;
                
                sortObj[mongoField] = desc ? -1 : 1;
            }
        } else {
            sortObj.createdAt = -1;
        }

        // Apply projection
        const projectionObj = {};
        if (fields && typeof fields === 'string') {
            const fieldList = fields.split(',');
            // Metadata is always selected
            projectionObj.tenantId = 1;
            projectionObj.collection = 1;
            projectionObj.ownerId = 1;
            projectionObj.createdAt = 1;
            projectionObj.updatedAt = 1;
            projectionObj.deletedAt = 1;

            for (const f of fieldList) {
                const cleanField = f.trim();
                if (cleanField && !cleanField.startsWith('$')) {
                    projectionObj[`data.${cleanField}`] = 1;
                }
            }
        }

        // Run raw MongoDB queries in parallel
        const options = {
            skip,
            limit: take,
            sort: sortObj
        };

        if (Object.keys(projectionObj).length > 0) {
            options.projection = projectionObj;
        }

        const [rawRecords, countResult] = await Promise.all([
            prisma.record.findRaw({
                filter: filterObj,
                options
            }),
            prisma.record.aggregateRaw({
                pipeline: [
                    { $match: filterObj },
                    { $count: "total" }
                ]
            })
        ]);

        const total = countResult[0]?.total || 0;
        const normalizedData = Array.isArray(rawRecords) ? rawRecords.map(normalizeRawDoc) : [];

        return {
            data: normalizedData,
            meta: {
                total,
                page: parseInt(page),
                limit: take,
                totalPages: Math.ceil(total / take)
            }
        };
    }

    async getRecordById(id, tenantId, collection, ownerId = null, includeDeleted = false) {
        const where = { id, tenantId, collection };
        if (ownerId) where.ownerId = ownerId;
        if (!includeDeleted) where.deletedAt = null;

        return prisma.record.findFirst({ where });
    }

    async updateRecord(id, tenantId, collection, ownerId, updateData) {
        // Enforce ownership / existence check
        const existing = await this.getRecordById(id, tenantId, collection, ownerId);

        if (!existing) return null;

        // Merge data object
        const newData = (typeof existing.data === 'object' && typeof updateData === 'object')
            ? { ...existing.data, ...updateData }
            : updateData;

        return prisma.record.update({
            where: { id },
            data: { 
                data: newData,
                updatedAt: new Date()
            }
        });
    }

    async deleteRecord(id, tenantId, collection, ownerId) {
        const existing = await this.getRecordById(id, tenantId, collection, ownerId);
        if (!existing) return null;

        // Soft delete
        return prisma.record.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async restoreRecord(id, tenantId, collection, ownerId) {
        // Look up including deleted records
        const existing = await this.getRecordById(id, tenantId, collection, ownerId, true);
        if (!existing || !existing.deletedAt) return null;

        return prisma.record.update({
            where: { id },
            data: { deletedAt: null }
        });
    }

    async deleteRecordPermanent(id, tenantId, collection, ownerId) {
        // Look up including deleted records
        const existing = await this.getRecordById(id, tenantId, collection, ownerId, true);
        if (!existing) return null;

        return prisma.record.delete({
            where: { id }
        });
    }
}

module.exports = new RecordRepository();
