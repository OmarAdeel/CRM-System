const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * JWT Authentication Middleware
 * Validates Bearer token from Authorization header
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
        message_ar: 'المصادقة مطلوبة. يرجى تقديم رمز صالح.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database to ensure they still exist and are active
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, role, language, territory, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
        message_ar: 'المستخدم غير موجود.',
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated.',
        message_ar: 'تم تعطيل الحساب.',
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        message_ar: 'انتهت صلاحية الرمز.',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        message_ar: 'رمز غير صالح.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Role-Based Access Control Middleware
 * @param  {...string} roles - Allowed roles (e.g., 'admin', 'manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
        message_ar: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
      });
    }
    next();
  };
};

module.exports = { auth, authorize };
