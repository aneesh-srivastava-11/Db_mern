const prisma = require('../config/db');
const createError = require('http-errors');

class CollectionRepository {
    async createCollection(tenantId, name, schema = null, validationEnabled = false, permissions = null, indexes = null) {
        try {
            return await prisma.collection.create({
                data: {
                    tenantId,
                    name,
                    schema,
                    validationEnabled,
                    permissions,
                    indexes
                }
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw createError(409, `Collection '${name}' already exists for this tenant`);
            }
            throw error;
        }
    }

    async updateCollection(tenantId, name, updateData) {
        const existing = await this.getCollectionByName(tenantId, name);
        if (!existing) {
            throw createError(404, `Collection '${name}' not found`);
        }

        return prisma.collection.update({
            where: {
                id: existing.id
            },
            data: {
                schema: updateData.schema !== undefined ? updateData.schema : existing.schema,
                validationEnabled: updateData.validationEnabled !== undefined ? updateData.validationEnabled : existing.validationEnabled,
                permissions: updateData.permissions !== undefined ? updateData.permissions : existing.permissions,
                indexes: updateData.indexes !== undefined ? updateData.indexes : existing.indexes
            }
        });
    }

    async getCollectionByName(tenantId, name) {
        return prisma.collection.findUnique({
            where: {
                tenantId_name: {
                    tenantId,
                    name
                }
            }
        });
    }

    async listCollections(tenantId) {
        return prisma.collection.findMany({
            where: { tenantId }
        });
    }

    async getCollectionMetadata(tenantId, name) {
        const collection = await this.getCollectionByName(tenantId, name);
        if (!collection) return null;

        const recordCount = await prisma.record.count({
            where: {
                tenantId,
                collection: name,
                deletedAt: null
            }
        });

        const deletedRecordCount = await prisma.record.count({
            where: {
                tenantId,
                collection: name,
                NOT: { deletedAt: null }
            }
        });

        return {
            collection,
            stats: {
                activeRecords: recordCount,
                deletedRecords: deletedRecordCount,
                totalRecords: recordCount + deletedRecordCount
            }
        };
    }
}

module.exports = new CollectionRepository();
