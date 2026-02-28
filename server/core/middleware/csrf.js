// server/core/middleware/csrf.js
// CSRF protection middleware
// Note: csurf is deprecated, but still functional. Consider migrating to csrf package in future.

const csrf = require('csurf');

const csrfProtection = csrf();

function csrfTokenHandler(req, res) {
  try {
    const token = req.csrfToken();
    if (req.session && typeof req.session.save === 'function') {
      req.session.save((saveError) => {
        if (saveError) {
          res.status(500).json({ error: 'Failed to persist CSRF session state' });
          return;
        }
        res.json({ csrfToken: token });
      });
      return;
    }
    res.json({ csrfToken: token });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
}

module.exports = {
  csrfProtection,
  csrfTokenHandler,
};
