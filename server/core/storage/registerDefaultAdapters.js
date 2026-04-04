// server/core/storage/registerDefaultAdapters.js
// Registers local + Google Drive adapters once per process.
const path = require('path');
const LocalStorageAdapter = require('./adapters/LocalStorageAdapter');
const GoogleDriveStorageAdapter = require('./adapters/GoogleDriveStorageAdapter');
const StorageProviderRegistry = require('./StorageProviderRegistry');

let registered = false;

function ensureStorageProvidersRegistered() {
  if (registered) {
    return;
  }
  const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
  StorageProviderRegistry.register('local', new LocalStorageAdapter({ uploadRoot }));
  StorageProviderRegistry.register('googledrive', new GoogleDriveStorageAdapter());
  registered = true;
}

module.exports = { ensureStorageProvidersRegistered };
