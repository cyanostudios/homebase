// plugins/guides/production/workerContext.js
/**
 * Build a minimal request object for background worker / cron contexts.
 * @param {import('pg').Pool} tenantPool
 * @param {number|string} userId
 */
function createWorkerReq(tenantPool, userId) {
  const uid = Number(userId);
  return {
    tenantPool,
    session: {
      user: { id: uid },
      currentTenantUserId: uid,
    },
  };
}

module.exports = { createWorkerReq };
