jest.mock('@/core/api/apiFetch', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '@/core/api/apiFetch';

import { garmentsApi } from '../garmentsApi';

const fetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('garmentsApi.duplicateList', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('posts the dialog name to the list duplicate route', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '9', name: 'Copy of list', assignedInventoryItemIds: ['5'] }),
    } as Response);

    await expect(garmentsApi.duplicateList('3', 'Copy of list')).resolves.toMatchObject({
      id: '9',
      assignedInventoryItemIds: ['5'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/garments/lists/3/duplicate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Copy of list' }),
      }),
    );
  });
});
