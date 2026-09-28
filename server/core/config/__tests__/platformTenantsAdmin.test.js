const {
  getEffectivePlatformTenantsAdminEmails,
  isEmailOnPlatformTenantsAdminAllowlist,
  applyTenantsPluginVisibility,
  PLATFORM_TENANTS_PLUGIN,
} = require('../platformTenantsAdmin');

describe('platformTenantsAdmin allowlist', () => {
  test('production only allows cyanostudios@gmail.com', () => {
    expect(getEffectivePlatformTenantsAdminEmails({ nodeEnv: 'production' })).toEqual([
      'cyanostudios@gmail.com',
    ]);
    expect(
      isEmailOnPlatformTenantsAdminAllowlist('admin@homebase.se', { nodeEnv: 'production' }),
    ).toBe(false);
    expect(
      isEmailOnPlatformTenantsAdminAllowlist('CyanoStudios@gmail.com', { nodeEnv: 'production' }),
    ).toBe(true);
  });

  test('non-production also allows admin@homebase.se', () => {
    expect(getEffectivePlatformTenantsAdminEmails({ nodeEnv: 'development' })).toEqual([
      'cyanostudios@gmail.com',
      'admin@homebase.se',
    ]);
    expect(
      isEmailOnPlatformTenantsAdminAllowlist('admin@homebase.se', { nodeEnv: 'development' }),
    ).toBe(true);
  });

  test('applyTenantsPluginVisibility injects or strips tenants', () => {
    expect(applyTenantsPluginVisibility(['contacts', 'tenants'], false)).toEqual(['contacts']);
    expect(applyTenantsPluginVisibility(['contacts'], true)).toEqual([
      'contacts',
      PLATFORM_TENANTS_PLUGIN,
    ]);
  });

  test('isPublicAppPlugin and locked tenant helpers', () => {
    const {
      isPublicAppPlugin,
      isPlatformAdminLockedTenant,
      isPluginToggleableInTenantsAdmin,
    } = require('../platformTenantsAdmin');
    expect(isPublicAppPlugin('public-cups')).toBe(true);
    expect(isPublicAppPlugin('cups')).toBe(false);
    expect(isPlatformAdminLockedTenant('cyanostudios@gmail.com', { nodeEnv: 'production' })).toBe(
      true,
    );
    expect(isPlatformAdminLockedTenant('admin@homebase.se', { nodeEnv: 'production' })).toBe(false);
    expect(isPlatformAdminLockedTenant('admin@homebase.se', { nodeEnv: 'development' })).toBe(true);
    expect(isPluginToggleableInTenantsAdmin('contacts', false)).toBe(true);
    expect(isPluginToggleableInTenantsAdmin('public-cups', false)).toBe(false);
    expect(isPluginToggleableInTenantsAdmin('contacts', true)).toBe(false);
  });

  test('isPlatformTenantsAdminSession uses session user email only (not tenant owner)', async () => {
    const { isPlatformTenantsAdminSession } = require('../platformTenantsAdmin');
    const db = {
      query: jest.fn(async () => [{ email: 'cyanostudios@gmail.com' }]),
    };
    // Member under allowlisted owner must not inherit admin
    await expect(
      isPlatformTenantsAdminSession(
        {
          session: {
            user: { email: 'member@example.com' },
            tenantOwnerUserId: 1,
          },
        },
        db,
        { nodeEnv: 'production' },
      ),
    ).resolves.toBe(false);
    expect(db.query).not.toHaveBeenCalled();

    await expect(
      isPlatformTenantsAdminSession(
        {
          session: {
            user: { email: 'cyanostudios@gmail.com' },
            tenantOwnerUserId: 1,
          },
        },
        db,
        { nodeEnv: 'production' },
      ),
    ).resolves.toBe(true);
  });
});
