const TenantsModel = require('../model');

describe('TenantsModel', () => {
  test('listTenants never returns connection strings', async () => {
    const pool = {
      query: jest.fn(async () => ({
        rows: [
          {
            id: 1,
            owner_user_id: 2,
            owner_email: 'a@b.c',
            organization: { name: 'Acme' },
            enabled_plugin_count: 3,
            neon_connection_string: 'postgres://secret',
          },
        ],
      })),
    };
    const model = new TenantsModel(pool);
    const list = await model.listTenants();
    expect(list).toEqual([
      {
        id: 1,
        ownerUserId: 2,
        ownerEmail: 'a@b.c',
        organizationName: 'Acme',
        enabledPluginCount: 3,
        pluginsLocked: false,
      },
    ]);
    expect(JSON.stringify(list)).not.toMatch(/connection|postgres:\/\//i);
  });

  test('updatePlugins rejects toggling tenants plugin', async () => {
    const pool = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('FROM tenants') && String(sql).includes('WHERE t.id')) {
          return {
            rows: [
              {
                id: 5,
                owner_user_id: 8,
                owner_email: 'x@y.z',
                organization: {},
              },
            ],
          };
        }
        if (String(sql).includes('information_schema')) {
          return { rows: [{ '?column?': 1 }] };
        }
        if (String(sql).includes('tenant_plugin_access') && String(sql).includes('SELECT')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
    const model = new TenantsModel(pool);
    await expect(
      model.updatePlugins(5, {
        enable: ['tenants'],
        grantedByUserId: 1,
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('tenants') });
  });

  test('updatePlugins rejects changes for platform-admin locked tenant', async () => {
    const pool = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('FROM tenants') && String(sql).includes('WHERE t.id')) {
          return {
            rows: [
              {
                id: 2,
                owner_user_id: 1,
                owner_email: 'cyanostudios@gmail.com',
                organization: {},
              },
            ],
          };
        }
        if (String(sql).includes('information_schema')) {
          return { rows: [{ '?column?': 1 }] };
        }
        if (String(sql).includes('tenant_plugin_access') && String(sql).includes('SELECT')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
    const model = new TenantsModel(pool);
    await expect(
      model.updatePlugins(2, {
        disable: ['contacts'],
        grantedByUserId: 1,
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('platform admin'),
    });
  });

  test('getTenant marks public-* as non-toggleable and locks admin tenant', async () => {
    const pool = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('FROM tenants') && String(sql).includes('WHERE t.id')) {
          return {
            rows: [
              {
                id: 2,
                owner_user_id: 1,
                owner_email: 'admin@homebase.se',
                organization: { name: 'Admin' },
              },
            ],
          };
        }
        if (String(sql).includes('information_schema')) {
          return { rows: [{ '?column?': 1 }] };
        }
        if (String(sql).includes('tenant_plugin_access') && String(sql).includes('SELECT')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
    const model = new TenantsModel(pool);
    const detail = await model.getTenant(2);
    expect(detail.pluginsLocked).toBe(true);
    expect(detail.plugins.every((p) => p.enabled)).toBe(true);
    expect(detail.plugins.every((p) => p.toggleable === false)).toBe(true);
    const publicRow = detail.plugins.find((p) => p.pluginName.startsWith('public-'));
    expect(publicRow?.publicApp).toBe(true);
  });
});
