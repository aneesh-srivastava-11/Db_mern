const prisma = require('../config/db');
const createError = require('http-errors');

class CollectionRepository {
    async createCollection(tenantId, name, schema = null) {
        try {
            return await prisma.collection.create({
                data: {
                    tenantId,
                    name,
                    schema
                }
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw createError(409, `Collection '${name}' already exists for this tenant`);
            }
            throw error;
        }
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
}

module.exports = new CollectionRepository();
