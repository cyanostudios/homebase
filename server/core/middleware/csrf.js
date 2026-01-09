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
if (csrf) {
  csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  });
} else {
  // Fallback: no-op middleware if csurf not available
  csrfProtection = (req, res, next) => {
    console.warn('CSRF protection disabled - csurf not installed');
    next();
  };
}

// CSRF token endpoint handler (must be before CSRF protection middleware)
// This endpoint should be called without CSRF protection to get the token
function csrfTokenHandler(req, res) {
  if (!csrf) {
    return res.status(503).json({ 
      error: 'CSRF protection not available',
      code: 'CSRF_NOT_CONFIGURED' 
    });
  }
  
  // Generate and return CSRF token
  // Note: csurf requires a session, so this should be called after login
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (error) {
    // If csrfToken() fails, it might be because csrfProtection middleware wasn't called
    // We need to call it first to initialize the token
    csrfProtection(req, res, () => {
      res.json({ csrfToken: req.csrfToken() });
    });
  }
}

module.exports = {
  csrfProtection,
  csrfTokenHandler,
};
