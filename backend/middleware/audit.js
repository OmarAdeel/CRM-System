const pool = require('../config/db');

/**
 * Audit Logging Middleware
 * Automatically logs data changes to the audit_logs table
 */
const auditLog = (entityType, action) => {
  return async (req, res, next) => {
    // Store original json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Only log on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const entityId = req.params.id || (body.data && body.data.id) || null;

        setImmediate(async () => {
          try {
            await pool.query(
              `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                req.user.id,
                entityType,
                entityId,
                action,
                req.ip,
                req.headers['user-agent'] || null,
              ]
            );
          } catch (err) {
            console.error('Audit log error:', err.message);
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
};

module.exports = auditLog;
