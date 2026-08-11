const fs = require('fs');
const path = require('path');

const CANONICAL_COLORS = [
  'black',
  'white',
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'teal',
];

function extractColorArray(source, constName) {
  const match = source.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`));
  if (!match) {
    throw new Error(`Could not find ${constName} array`);
  }
  return [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

describe('team and schedule color enums', () => {
  test('teams model and routes share canonical TEAM_COLORS including black and yellow', () => {
    const modelSrc = fs.readFileSync(path.join(__dirname, '../model.js'), 'utf8');
    const routesSrc = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
    expect(extractColorArray(modelSrc, 'TEAM_COLORS')).toEqual(CANONICAL_COLORS);
    expect(extractColorArray(routesSrc, 'TEAM_COLORS')).toEqual(CANONICAL_COLORS);
  });

  test('schedule model and routes share the same canonical SCHEDULE_COLORS', () => {
    const scheduleRoot = path.join(__dirname, '../../schedule');
    const modelSrc = fs.readFileSync(path.join(scheduleRoot, 'model.js'), 'utf8');
    const routesSrc = fs.readFileSync(path.join(scheduleRoot, 'routes.js'), 'utf8');
    expect(extractColorArray(modelSrc, 'SCHEDULE_COLORS')).toEqual(CANONICAL_COLORS);
    expect(extractColorArray(routesSrc, 'SCHEDULE_COLORS')).toEqual(CANONICAL_COLORS);
  });
});
