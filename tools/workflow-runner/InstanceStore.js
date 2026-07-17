'use strict';

const fs = require('fs');
const path = require('path');

const INSTANCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * File-backed InstanceStore (ADR I2).
 * Paths are always resolved under storeRoot; InstanceId is validated.
 */
class InstanceStore {
  /**
   * @param {string} [storeRoot] Absolute or relative path to `.workflow-runner/instances`
   */
  constructor(storeRoot) {
    this.storeRoot = path.resolve(
      storeRoot || path.join(process.cwd(), '.workflow-runner', 'instances'),
    );
  }

  ensureDir() {
    fs.mkdirSync(this.storeRoot, { recursive: true });
  }

  assertInstanceId(instanceId) {
    if (typeof instanceId !== 'string' || !INSTANCE_ID_RE.test(instanceId)) {
      throw new Error(
        `Invalid InstanceId: must match ${INSTANCE_ID_RE} (got ${JSON.stringify(instanceId)})`,
      );
    }
  }

  filePath(instanceId) {
    this.assertInstanceId(instanceId);
    const file = path.join(this.storeRoot, `${instanceId}.json`);
    const resolved = path.resolve(file);
    if (!resolved.startsWith(this.storeRoot + path.sep) && resolved !== this.storeRoot) {
      throw new Error('Instance path escapes store root');
    }
    return resolved;
  }

  /**
   * @param {string} instanceId
   * @returns {object | null}
   */
  load(instanceId) {
    const fp = this.filePath(instanceId);
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf8');
    return JSON.parse(raw);
  }

  /**
   * @param {object} instance
   */
  save(instance) {
    if (!instance || !instance.InstanceId) {
      throw new Error('Instance must include InstanceId');
    }
    this.ensureDir();
    const fp = this.filePath(instance.InstanceId);
    const tmp = `${fp}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(instance, null, 2), 'utf8');
    fs.renameSync(tmp, fp);
    return instance;
  }

  exists(instanceId) {
    return fs.existsSync(this.filePath(instanceId));
  }
}

module.exports = { InstanceStore, INSTANCE_ID_RE };
