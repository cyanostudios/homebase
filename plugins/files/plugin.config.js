/**
 * Files plugin
 * Provides CRUD for user-owned files metadata (name, size, mimeType, url).
 */
module.exports = {
  name: 'files',           // plural-kebab
  routeBase: '/api/files', // must match name
  requiredRole: 'user',
  description: 'User file metadata management (upload endpoints to be extended).',
};
