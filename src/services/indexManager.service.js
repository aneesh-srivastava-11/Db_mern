const prisma = require('../config/db');
const logger = require('../utils/logger');

class IndexManagerService {
    /**
     * Creates database indexes dynamically for custom collection fields.
     * All custom indexes are compound, scope-bound by tenantId and collection.
     * Example: index on "email" becomes index on { tenantId: 1, collection: 1, "data.email": 1 }
     */
    async syncIndexes(tenantId, collectionName, indexesList) {
        if (!indexesList || !Array.isArray(indexesList)) {
            return;
        }

        for (const field of indexesList) {
            if (typeof field !== 'string' || !field.trim()) continue;

            const fieldName = field.trim();
            const indexName = `idx_${tenantId}_${collectionName}_data_${fieldName}`.replace(/[^a-zA-Z0-9_]/g, '_');

            try {
                logger.info({ tenantId, collectionName, fieldName, indexName }, 'Ensuring dynamic MongoDB index exists');
                
                await prisma.$runCommandRaw({
                    createIndexes: "Record",
                    indexes: [
                        {
                            key: {
                                tenantId: 1,
                                collection: 1,
                                [`data.${fieldName}`]: 1
                            },
                            name: indexName,
                            background: true
                        }
                    ]
                });
            } catch (error) {
                // If it fails (e.g. because of duplicate options or other drivers), log it but don't crash
                logger.error({ err: error, tenantId, collectionName, fieldName }, 'Failed to ensure dynamic index');
            }
        }
    }
}

module.exports = new IndexManagerService();
