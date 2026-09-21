const fs = require('fs');
const path = require('path');

const forms = [
  {
    name: 'SlotForm',
    file: path.join(__dirname, '../../../slots/components/SlotForm.tsx'),
  },
  {
    name: 'GarmentForm',
    file: path.join(__dirname, '../../../garments/components/GarmentForm.tsx'),
  },
  {
    name: 'InstructionForm',
    file: path.join(__dirname, '../../../instructions/components/InstructionForm.tsx'),
  },
  {
    name: 'FileForm',
    file: path.join(__dirname, '../FileForm.tsx'),
  },
];

describe('Wave B mail-layout forms: session leave + ghost facts', () => {
  for (const { name, file } of forms) {
    const src = fs.readFileSync(file, 'utf8');

    test(`${name} registers session leave and force close`, () => {
      expect(src).toMatch(/registerUnsavedChangesChecker\([^,]+,\s*\(\)\s*=>\s*true\)/);
      expect(src).toMatch(/force:\s*true/);
    });

    test(`${name} uses ghost fact field styling`, () => {
      expect(src).toMatch(/FORM_GHOST_INPUT_CLASS/);
    });
  }
});
