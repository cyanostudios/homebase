// plugins/guides/__tests__/list-guides-enabled-tenants.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const {
  listGuidesEnabledTenants,
  GUIDES_ENABLED_SQL,
  PLUGIN_NAME,
} = require('../production/listGuidesEnabledTenants');

describe('listGuidesEnabledTenants', () => {
  test('exports guides plugin name and access predicate', () => {
    expect(PLUGIN_NAME).toBe('guides');
    expect(GUIDES_ENABLED_SQL).toContain("plugin_name = 'guides'");
    expect(GUIDES_ENABLED_SQL).toContain('tenant_plugin_access');
    expect(GUIDES_ENABLED_SQL).toContain('user_plugin_access');
  });

  test('neon mode queries only tenants with guides enabled', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          user_id: 2,
          email: 'user@homebase.se',
          connection_string: 'postgres://tenant/db',
        },
      ],
    });
    const rows = await listGuidesEnabledTenants(
      { query },
      { tenantProvider: 'neon', databaseUrl: 'postgres://main' },
    );

    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('tenant_plugin_access');
    expect(sql).toContain("plugin_name = 'guides'");
    expect(sql).toContain('neon_connection_string');
    expect(rows).toEqual([
      {
        user_id: 2,
        email: 'user@homebase.se',
        connection_string: 'postgres://tenant/db',
      },
    ]);
  });

  test('local mode scopes connection_string to tenant schema', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ user_id: 7, email: 'user@homebase.se' }],
    });
    const rows = await listGuidesEnabledTenants(
      { query },
      { tenantProvider: 'local', databaseUrl: 'postgres://localhost/homebase_dev' },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(7);
    expect(rows[0].connection_string).toContain('search_path%3Dtenant_7');
  });

  test('returns empty list when plugin-access relation is missing', async () => {
    const err = Object.assign(new Error('relation "tenant_plugin_access" does not exist'), {
      code: '42P01',
    });
    const query = jest.fn().mockRejectedValue(err);
    await expect(listGuidesEnabledTenants({ query }, { tenantProvider: 'neon' })).resolves.toEqual(
      [],
    );
  });
});
