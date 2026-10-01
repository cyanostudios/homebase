import {
  handleStatKpiListFilterSelect,
  isStatKpiListFilterPressed,
} from '../statKpiListFilterLink';

describe('statKpiListFilterLink', () => {
  test('isStatKpiListFilterPressed treats total as empty selection', () => {
    expect(isStatKpiListFilterPressed([], 'total')).toBe(true);
    expect(isStatKpiListFilterPressed(['open'], 'total')).toBe(false);
    expect(isStatKpiListFilterPressed(['open'], 'open')).toBe(true);
  });

  test('handleStatKpiListFilterSelect sets filter and opens chips', () => {
    const setVisible = jest.fn();
    const setFilters = jest.fn();
    handleStatKpiListFilterSelect('completed', setVisible, setFilters);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(setFilters).toHaveBeenCalledWith(['completed']);

    setVisible.mockClear();
    setFilters.mockClear();
    handleStatKpiListFilterSelect('total', setVisible, setFilters);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(setFilters).toHaveBeenCalledWith([]);
  });
});
