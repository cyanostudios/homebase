jest.mock('../../../server/core/ServiceManager', () => ({
  getMainPool: jest.fn(),
}));
jest.mock('../../../server/core/services/tenant/TenantContextService');
jest.mock('../../../server/core/services/organization/OrganizationService', () => ({
  OrganizationService: jest.fn(),
}));

const ServiceManager = require('../../../server/core/ServiceManager');
const TenantContextService = require('../../../server/core/services/tenant/TenantContextService');
const {
  OrganizationService,
} = require('../../../server/core/services/organization/OrganizationService');
const PublicClubdeskController = require('../controller');

describe('PublicClubdeskController.getBranding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns organization name and logoUrl for configured owner', async () => {
    ServiceManager.getMainPool.mockReturnValue({});
    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue({ tenantId: 9 }),
    }));
    OrganizationService.mockImplementation(() => ({
      getOrganization: jest.fn().mockResolvedValue({
        name: 'Sorgenfri FF',
        logoUrl: 'https://cdn.example/logo.png',
      }),
    }));

    const controller = new PublicClubdeskController({});
    const req = { publicClubdeskOwnerUserId: 3 };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getBranding(req, res);

    expect(res.json).toHaveBeenCalledWith({
      name: 'Sorgenfri FF',
      logoUrl: 'https://cdn.example/logo.png',
    });
  });

  test('strips non-http logoUrl from organization profile', async () => {
    ServiceManager.getMainPool.mockReturnValue({});
    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue({ tenantId: 9 }),
    }));
    OrganizationService.mockImplementation(() => ({
      getOrganization: jest.fn().mockResolvedValue({
        name: 'Club',
        logoUrl: 'javascript:alert(1)',
      }),
    }));

    const controller = new PublicClubdeskController({});
    const req = { publicClubdeskOwnerUserId: 3 };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getBranding(req, res);

    expect(res.json).toHaveBeenCalledWith({ name: 'Club', logoUrl: '' });
  });

  test('returns 503 when owner is not configured', async () => {
    const prevId = process.env.PUBLIC_CLUBDESK_USER_ID;
    const prevEmail = process.env.PUBLIC_CLUBDESK_USER_EMAIL;
    delete process.env.PUBLIC_CLUBDESK_USER_ID;
    delete process.env.PUBLIC_CLUBDESK_USER_EMAIL;

    const controller = new PublicClubdeskController({});
    const req = { publicClubdeskOwnerUserId: null };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getBranding(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Public clubdesk not configured' });

    if (prevId !== undefined) process.env.PUBLIC_CLUBDESK_USER_ID = prevId;
    if (prevEmail !== undefined) process.env.PUBLIC_CLUBDESK_USER_EMAIL = prevEmail;
  });
});
