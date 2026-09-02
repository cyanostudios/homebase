import type { GarmentCheckboxColumn } from '@/plugins/garments/types/garments';
import {
  MAX_CHECKBOX_COLUMNS,
  PAID_COLUMN_ID,
  addCustomCheckboxColumn,
  addPaidCheckboxColumn,
  applyPersonCheckboxColumnDraft,
  createCustomCheckboxColumn,
  isCustomCheckboxColumnId,
  isInventoryStatusColumnId,
  isSystemCheckboxColumnId,
  listCustomCheckboxColumns,
  listEditablePersonCheckboxColumns,
  personCheckboxColumnsEqual,
  removeCustomCheckboxColumn,
  renameCustomCheckboxColumn,
  reorderPersonCheckboxColumnIds,
  setPersonCheckboxColumnHidden,
} from '@/plugins/garments/utils/customCheckboxColumns';

const systemColumns: GarmentCheckboxColumn[] = [
  { id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 0 },
  { id: 'person_blankett_fogis', label: 'Fogis form', sortOrder: 1 },
  { id: 'inv_12_ordered', label: 'Ordered', group: 'Shorts', sortOrder: 2 },
  { id: 'inv_12_delivered', label: 'Delivered', group: 'Shorts', sortOrder: 3 },
  { id: 'inv_12_handed_out', label: 'Handed out', group: 'Shorts', sortOrder: 4 },
  { id: 'shorts_bestallt', label: 'Ordered', group: 'Shorts', sortOrder: 5 },
  { id: 'troja_levererat', label: 'Delivered', group: 'Shirt', sortOrder: 6 },
  { id: 'strumpor_utdelat', label: 'Handed out', group: 'Socks', sortOrder: 7 },
];

describe('customCheckboxColumns', () => {
  describe('id classifiers', () => {
    it('detects inventory status column ids', () => {
      expect(isInventoryStatusColumnId('inv_1_ordered')).toBe(true);
      expect(isInventoryStatusColumnId('inv_99_delivered')).toBe(true);
      expect(isInventoryStatusColumnId('inv_3_handed_out')).toBe(true);
      expect(isInventoryStatusColumnId('inv_3_other')).toBe(false);
      expect(isInventoryStatusColumnId(PAID_COLUMN_ID)).toBe(false);
    });

    it('detects system column ids (paid, fogis, inv_*, legacy groups)', () => {
      for (const col of systemColumns) {
        expect(isSystemCheckboxColumnId(col.id)).toBe(true);
      }
      expect(isSystemCheckboxColumnId('custom_abc')).toBe(false);
      expect(isSystemCheckboxColumnId('person_other')).toBe(false);
    });

    it('detects custom column ids', () => {
      expect(isCustomCheckboxColumnId('custom_abc')).toBe(true);
      expect(isCustomCheckboxColumnId('custom_')).toBe(true);
      expect(isCustomCheckboxColumnId(PAID_COLUMN_ID)).toBe(false);
      expect(isCustomCheckboxColumnId('inv_1_ordered')).toBe(false);
    });
  });

  describe('createCustomCheckboxColumn', () => {
    it('creates person-level columns with custom_ id and no group', () => {
      const col = createCustomCheckboxColumn('  Measured  ', 3);
      expect(col.label).toBe('Measured');
      expect(col.sortOrder).toBe(3);
      expect(col.group).toBeUndefined();
      expect(col.id.startsWith('custom_')).toBe(true);
      expect(col.id.length).toBeGreaterThan('custom_'.length);
    });
  });

  describe('list / add / rename / remove', () => {
    it('lists only custom columns sorted by sortOrder', () => {
      const columns: GarmentCheckboxColumn[] = [
        ...systemColumns,
        { id: 'custom_b', label: 'B', sortOrder: 20 },
        { id: 'custom_a', label: 'A', sortOrder: 10 },
      ];
      expect(listCustomCheckboxColumns(columns).map((c) => c.id)).toEqual(['custom_a', 'custom_b']);
    });

    it('lists editable person columns as Paid + custom when present (excludes Fogis)', () => {
      const columns: GarmentCheckboxColumn[] = [
        ...systemColumns,
        { id: 'custom_a', label: 'A', sortOrder: 10 },
      ];
      expect(listEditablePersonCheckboxColumns(columns).map((c) => c.id)).toEqual([
        PAID_COLUMN_ID,
        'custom_a',
      ]);
    });

    it('does not re-insert Paid when the list removed it', () => {
      const columns: GarmentCheckboxColumn[] = [
        { id: 'custom_a', label: 'A', sortOrder: 0 },
        { id: 'inv_12_ordered', label: 'Ordered', group: 'Shorts', sortOrder: 1 },
      ];
      expect(listEditablePersonCheckboxColumns(columns).map((c) => c.id)).toEqual(['custom_a']);
    });

    it('adds a custom column without dropping system columns', () => {
      const next = addCustomCheckboxColumn(systemColumns, 'Measured');
      expect(next).toHaveLength(systemColumns.length + 1);
      for (const col of systemColumns) {
        expect(next.find((c) => c.id === col.id)).toEqual(col);
      }
      const added = next[next.length - 1];
      expect(added.label).toBe('Measured');
      expect(added.group).toBeUndefined();
      expect(isCustomCheckboxColumnId(added.id)).toBe(true);
      expect(added.sortOrder).toBe(8);
    });

    it('returns same array for empty label on add', () => {
      const next = addCustomCheckboxColumn(systemColumns, '   ');
      expect(next).toBe(systemColumns);
    });

    it('throws when adding at the 50-column cap', () => {
      const capped: GarmentCheckboxColumn[] = Array.from(
        { length: MAX_CHECKBOX_COLUMNS },
        (_, i) =>
          i === 0
            ? { id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 0 }
            : { id: `custom_${i}`, label: `C${i}`, sortOrder: i },
      );
      expect(() => addCustomCheckboxColumn(capped, 'One more')).toThrow('MAX_CHECKBOX_COLUMNS');
    });

    it('renames only custom columns', () => {
      const columns: GarmentCheckboxColumn[] = [
        ...systemColumns,
        { id: 'custom_x', label: 'Old', sortOrder: 10 },
      ];
      const renamed = renameCustomCheckboxColumn(columns, 'custom_x', '  New  ');
      expect(renamed.find((c) => c.id === 'custom_x')?.label).toBe('New');
      expect(renameCustomCheckboxColumn(columns, PAID_COLUMN_ID, 'Nope')).toBe(columns);
      expect(renameCustomCheckboxColumn(columns, 'custom_x', '  ')).toBe(columns);
    });

    it('removes Paid and custom columns but never inventory or Fogis', () => {
      const columns: GarmentCheckboxColumn[] = [
        ...systemColumns,
        { id: 'custom_x', label: 'X', sortOrder: 10 },
      ];
      const removedCustom = removeCustomCheckboxColumn(columns, 'custom_x');
      expect(removedCustom.find((c) => c.id === 'custom_x')).toBeUndefined();
      expect(removedCustom).toHaveLength(systemColumns.length);
      for (const col of systemColumns) {
        expect(removedCustom.find((c) => c.id === col.id)).toEqual(col);
      }
      const removedPaid = removeCustomCheckboxColumn(columns, PAID_COLUMN_ID);
      expect(removedPaid.find((c) => c.id === PAID_COLUMN_ID)).toBeUndefined();
      expect(removeCustomCheckboxColumn(columns, 'inv_12_ordered')).toBe(columns);
      expect(removeCustomCheckboxColumn(columns, 'shorts_bestallt')).toBe(columns);
      expect(removeCustomCheckboxColumn(columns, 'person_blankett_fogis')).toBe(columns);
    });

    it('can restore Paid after delete', () => {
      const withoutPaid: GarmentCheckboxColumn[] = [{ id: 'custom_x', label: 'X', sortOrder: 0 }];
      const restored = addPaidCheckboxColumn(withoutPaid);
      expect(restored.map((c) => c.id)).toEqual([PAID_COLUMN_ID, 'custom_x']);
      expect(addPaidCheckboxColumn(restored)).toBe(restored);
    });
  });

  describe('settings draft helpers', () => {
    it('reorders person column ids', () => {
      expect(reorderPersonCheckboxColumnIds(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    });

    it('toggles hidden on custom columns and Paid', () => {
      const columns: GarmentCheckboxColumn[] = [
        { id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 0 },
        { id: 'custom_x', label: 'X', sortOrder: 1 },
      ];
      const hiddenCustom = setPersonCheckboxColumnHidden(columns, 'custom_x', true);
      expect(hiddenCustom.find((c) => c.id === 'custom_x')?.hidden).toBe(true);
      const hiddenPaid = setPersonCheckboxColumnHidden(columns, PAID_COLUMN_ID, true);
      expect(hiddenPaid.find((c) => c.id === PAID_COLUMN_ID)?.hidden).toBe(true);
      const shown = setPersonCheckboxColumnHidden(hiddenPaid, PAID_COLUMN_ID, false);
      expect(shown.find((c) => c.id === PAID_COLUMN_ID)?.hidden).toBeUndefined();
    });

    it('applies draft without dropping inventory or Fogis columns', () => {
      const all: GarmentCheckboxColumn[] = [
        ...systemColumns,
        { id: 'custom_x', label: 'X', sortOrder: 10 },
      ];
      const draft = [
        { id: 'custom_x', label: 'X', sortOrder: 0, hidden: true },
        { id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 1 },
      ];
      const next = applyPersonCheckboxColumnDraft(all, draft);
      expect(next.map((c) => c.id)).toEqual([
        'custom_x',
        PAID_COLUMN_ID,
        'person_blankett_fogis',
        'inv_12_ordered',
        'inv_12_delivered',
        'inv_12_handed_out',
        'shorts_bestallt',
        'troja_levererat',
        'strumpor_utdelat',
      ]);
      expect(next.find((c) => c.id === 'custom_x')?.hidden).toBe(true);
    });

    it('compares person column drafts', () => {
      const a = [{ id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 0 }];
      const b = [{ id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 0 }];
      expect(personCheckboxColumnsEqual(a, b)).toBe(true);
      expect(personCheckboxColumnsEqual(a, [{ ...b[0], hidden: true }])).toBe(false);
    });
  });
});
