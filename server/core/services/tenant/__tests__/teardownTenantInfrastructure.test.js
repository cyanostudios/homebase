const { teardownTenantInfrastructure, asRows } = require('../teardownTenantInfrastructure');

describe('asRows', () => {
  test('normalizes adapter array and pg { rows }', () => {
    expect(asRows([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(asRows({ rows: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(asRows(null)).toEqual([]);
  });
});

describe('teardownTenantInfrastructure', () => {
  test('calls deleteTenant before catalog would be removed; non-404 aborts', async () => {
    const db = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('FROM tenants')) {
          return [
            {
              id: 9,
              neon_project_id: 'proj-x',
              neon_connection_string: 'postgres://tenant-db',
            },
          ];
        }
        if (String(sql).includes('public_share_routing')) return [];
        if (String(sql).includes('tenant_memberships')) return [{ user_id: 3 }];
        if (String(sql).includes('sessions')) return [];
        return [];
      }),
    };
    const deleteTenant = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('Neon down'), { response: { status: 500 } }));
    const closeTenantPool = jest.fn().mockResolvedValue(undefined);
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    await expect(
      teardownTenantInfrastructure(3, {
        db,
        tenantService: { deleteTenant },
        connectionPool: { closeTenantPool },
        logger,
      }),
    ).rejects.toThrow('Neon down');

    expect(closeTenantPool).toHaveBeenCalledWith('postgres://tenant-db');
    expect(deleteTenant).toHaveBeenCalledWith(3);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('public_share_routing'), [
      'postgres://tenant-db',
    ]);
    // sessions not reached after failure
    expect(db.query.mock.calls.some((c) => String(c[0]).includes('sessions'))).toBe(false);
  });

  test('treats Neon 404 as success and clears sessions', async () => {
    const db = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('FROM tenants')) {
          return [
            {
              id: 9,
              neon_project_id: 'proj-x',
              neon_connection_string: 'postgres://tenant-db',
            },
          ];
        }
        if (String(sql).includes('tenant_memberships')) return [{ user_id: 3 }];
        return [];
      }),
    };
    const deleteTenant = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('gone'), { response: { status: 404 } }));

    const result = await teardownTenantInfrastructure(3, {
      db,
      tenantService: { deleteTenant },
      connectionPool: { closeTenantPool: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    expect(result).toEqual({ skipped: false, tenantId: 9, projectId: 'proj-x' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sessions'), [
      '9',
      ['3'],
    ]);
  });

  test('skips when no tenants row', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    const deleteTenant = jest.fn();
    const result = await teardownTenantInfrastructure(99, {
      db,
      tenantService: { deleteTenant },
      connectionPool: {},
      logger: { info: jest.fn() },
    });
    expect(result).toEqual({ skipped: true });
    expect(deleteTenant).not.toHaveBeenCalled();
  });
});
