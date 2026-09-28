const {
  applyPluginAccessChanges,
  setPluginAccess,
  listPluginAccess,
} = require('../tenantPluginAccess');

describe('tenantPluginAccess', () => {
  test('setPluginAccess upserts tenant and user rows', async () => {
    const queries = [];
    const pool = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql, params });
        return { rows: [] };
      }),
    };
    await setPluginAccess(
      pool,
      { tenantPlugin: true, userPlugin: true },
      {
        tenantId: 3,
        ownerUserId: 9,
        pluginName: 'tasks',
        enabled: true,
        grantedByUserId: 1,
      },
    );
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain('tenant_plugin_access');
    expect(queries[0].params).toEqual([3, 'tasks', true, 1]);
    expect(queries[1].sql).toContain('user_plugin_access');
  });

  test('applyPluginAccessChanges rejects when neither table exists', async () => {
    const pool = {
      query: jest.fn(async () => ({ rows: [] })),
    };
    await expect(
      applyPluginAccessChanges(pool, {
        tenantId: 1,
        ownerUserId: 1,
        enable: ['tasks'],
      }),
    ).rejects.toThrow(/Neither tenant_plugin_access/);
  });

  test('listPluginAccess returns rows from tenant_plugin_access', async () => {
    const pool = {
      query: jest.fn(async () => ({
        rows: [{ plugin_name: 'contacts', enabled: true }],
      })),
    };
    const rows = await listPluginAccess(pool, { tenantPlugin: true, userPlugin: false }, 1, 2);
    expect(rows).toEqual([{ plugin_name: 'contacts', enabled: true }]);
  });
});
