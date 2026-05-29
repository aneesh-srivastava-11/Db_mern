const auditService = require('../services/audit.service');
const createError = require('http-errors');

class AuditController {
    async listLogs(req, res) {
        const { tenantId, role } = req.user;
        const { page, limit } = req.query;

        // Strictly enforce Admin only
        if (role !== 'admin') {
            throw createError(403, 'Forbidden: Only admins can view audit logs');
        }

        const result = await auditService.getLogs(tenantId, { page, limit });
        res.status(200).json({ success: true, ...result });
    }
}

module.exports = new AuditController();
