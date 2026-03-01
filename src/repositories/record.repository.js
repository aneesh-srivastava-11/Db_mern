const prisma = require('../config/db');

class RecordRepository {
    async createRecord(tenantId, collection, ownerId, data) {
        return prisma.record.create({
            data: {
                tenantId,
                collection,
                ownerId,
                data
            }
        });
    }

    async findRecords(tenantId, collection, ownerId = null, queryOptions = {}) {
        const { page = 1, limit = 10 } = queryOptions;

        // Convert page and limit to integers and ensure minimums
        const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
        const take = Math.max(1, parseInt(limit));

        const where = { tenantId, collection };
        // Ownership enforcement
        if (ownerId) {
            where.ownerId = ownerId;
        }

        const [data, total] = await Promise.all([
            prisma.record.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.record.count({ where })
        ]);

        return {
            data,
            meta: {
                total,
                page: parseInt(page),
                limit: take,
                totalPages: Math.ceil(total / take)
            }
        };
    }

    async getRecordById(id, tenantId, collection, ownerId = null) {
        const where = { id, tenantId, collection };
        if (ownerId) where.ownerId = ownerId;

        return prisma.record.findFirst({ where });
    }

    async updateRecord(id, tenantId, collection, ownerId, updateData) {
        const existing = await this.getRecordById(id, tenantId, collection, ownerId);

        if (!existing) return null;

        // Merge existing data with update data if they are objects
        const newData = (typeof existing.data === 'object' && typeof updateData === 'object')
            ? { ...existing.data, ...updateData }
            : updateData;

        return prisma.record.update({
            where: { id },
            data: { data: newData }
        });
    }

    async deleteRecord(id, tenantId, collection, ownerId) {
        const existing = await this.getRecordById(id, tenantId, collection, ownerId);

        if (!existing) return null;

        return prisma.record.delete({
            where: { id }
        });
    }
}

module.exports = new RecordRepository();
