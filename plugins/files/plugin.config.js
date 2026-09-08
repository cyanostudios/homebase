/**
 * Files plugin
 * User file metadata, multipart upload (local / R2 / Google Drive), and entity attachments.
 */
module.exports = {
  name: 'files',
  routeBase: '/api/files',
  requiredRole: 'user',
  description: 'File library, uploads via StorageProviderRegistry, and cross-plugin attachments.',
};
