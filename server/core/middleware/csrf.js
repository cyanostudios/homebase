// server/core/middleware/csrf.js
// CSRF protection middleware
// Note: csurf is deprecated, but still functional. Consider migrating to csrf package in future.

let csrf;
try {
  // Try to use csurf (deprecated but still works)
  csrf = require('csurf');
} catch (e) {
  // Fallback: create a simple CSRF implementation
  console.warn('csurf not installed, CSRF protection disabled. Install with: npm install csurf');
  csrf = null;
}

// CSRF protection for state-changing operations
let csrfProtection;
const enableCsrf = process.env.ENABLE_CSRF === 'true';

if (enableCsrf && csrf) {
  csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  });
} else {
  // CSRF protection disabled
  csrfProtection = (req, res, next) => {
    // No-op middleware - CSRF protection disabled
    next();
  };
}

// CSRF token endpoint handler
function csrfTokenHandler(req, res, next) {
  if (enableCsrf && req.csrfToken) {
    res.json({ csrfToken: req.csrfToken() });
  } else {
    // CSRF protection disabled - return dummy token
    res.json({ csrfToken: 'csrf-disabled' });
  }
}

module.exports = {
  csrfProtection,
  csrfTokenHandler,
};
