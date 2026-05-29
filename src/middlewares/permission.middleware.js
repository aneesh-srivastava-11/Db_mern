const collectionRepo = require('../repositories/collection.repository');
const createError = require('http-errors');

/**
 * Middleware to check collection-level permissions.
 * Actions can be: 'read', 'write', 'delete'
 */
const checkCollectionPermission = (action) => {
    return async (req, res, next) => {
        // By default, if auth failed or was skipped, req.user might be guest (role: 'public')
        const user = req.user || { role: 'public', userId: 'anonymous', tenantId: req.headers['x-tenant-id'] || req.query.tenantId };
        const { tenantId, role } = user;
        const { collection } = req.params;

        if (!tenantId) {
            return next(createError(400, 'Tenant context is required'));
        }

        try {
            const coll = await collectionRepo.getCollectionByName(tenantId, collection);
            if (!coll) {
                return next(createError(404, `Collection '${collection}' not found`));
            }

            // Cache the collection metadata on the request object so subsequent handlers don't have to query again
            req.collectionConfig = coll;

            // Admin override is always allowed
            if (role === 'admin') {
                return next();
            }

            const permissions = coll.permissions;
            
            // If no permissions object is defined, fallback to default behavior (all authenticated tenant users have access, ownership checked in controller)
            if (!permissions) {
                if (role === 'public') {
                    return next(createError(401, 'Unauthorized: Access requires authentication'));
                }
                return next();
            }

            const allowedRoles = permissions[action];

            // If action role rules are not defined for this action, treat it as authenticated-only by default
            if (!allowedRoles || !Array.isArray(allowedRoles)) {
                if (role === 'public') {
                    return next(createError(401, 'Unauthorized: Access requires authentication'));
                }
                return next();
            }

            // Check if user's role is in the allowed roles list
            if (allowedRoles.includes(role)) {
                return next();
            }

            // Support public read/write if 'public' is explicitly in the allowed roles
            if (allowedRoles.includes('public')) {
                return next();
            }

            // Otherwise, access is forbidden
            return next(createError(403, `Forbidden: Role '${role}' does not have '${action}' permission for collection '${collection}'`));

        } catch (error) {
            return next(error);
        }
    };
};

module.exports = checkCollectionPermission;
