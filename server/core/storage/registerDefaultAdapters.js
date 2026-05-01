// server/core/storage/registerDefaultAdapters.js
// Registers local + Google Drive + R2 adapters once per process.
const path = require('path');
const LocalStorageAdapter = require('./adapters/LocalStorageAdapter');
const GoogleDriveStorageAdapter = require('./adapters/GoogleDriveStorageAdapter');
const { R2StorageAdapter, isR2Configured } = require('./adapters/R2StorageAdapter');
const StorageProviderRegistry = require('./StorageProviderRegistry');

let registered = false;

function ensureStorageProvidersRegistered() {
  if (registered) {
    return;
  }
  const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
  StorageProviderRegistry.register('local', new LocalStorageAdapter({ uploadRoot }));
  StorageProviderRegistry.register('googledrive', new GoogleDriveStorageAdapter());
  if (isR2Configured()) {
    StorageProviderRegistry.register('r2', new R2StorageAdapter());
  }
  registered = true;
}

module.exports = { ensureStorageProvidersRegistered };
