// plugins/sportadmin/providers/SportAdminProvider.js
const { runSportadminSync } = require('../services/syncService');

class SportAdminProvider {
  constructor(model) {
    this.id = 'sportadmin';
    this.model = model;
  }

  async sync(req, opts) {
    return runSportadminSync(this.model, req, opts);
  }
}

module.exports = { SportAdminProvider };
