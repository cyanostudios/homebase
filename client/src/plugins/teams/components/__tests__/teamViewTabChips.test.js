const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../TeamView.tsx'), 'utf8');
const qcSrc = fs.readFileSync(path.join(__dirname, '../TeamQuickContextPanel.tsx'), 'utf8');
const stylesSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/detailViewCardStyles.ts'),
  'utf8',
);

describe('TeamView detail tab chips', () => {
  test('uses compact list filter chip tokens (same size/colors as list filters)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).not.toMatch(/LIST_FILTER_CHIP_LG_/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('full detail mounts tabs under QuickContext header and drops identity card', () => {
    expect(viewSrc).toMatch(/TeamQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).not.toMatch(/statPlayers/);
    expect(viewSrc).not.toMatch(/TEAM_COLOR_GRADIENTS\[team\.color\]/);
    expect(viewSrc).not.toMatch(/teams\.form\.detailsSection/);
    expect(viewSrc).not.toMatch(/DETAIL_INFO_ROW_CLASS/);
    expect(qcSrc).toMatch(/headerBelow\?: React\.ReactNode/);
    expect(qcSrc).toMatch(/\{headerBelow \? <div className="mt-4">\{headerBelow\}<\/div> : null\}/);
  });

  test('full detail shows meta under the title before tabs', () => {
    expect(qcSrc).toMatch(/fullHeaderMetaLine/);
    expect(qcSrc).toMatch(/fullHeaderMeta/);
    expect(qcSrc).toMatch(/getDisplaySeriesTeams/);
    expect(qcSrc).toMatch(/teams\.playerCount/);
    expect(qcSrc).toMatch(/teams\.seriesTeamCount/);
    expect(qcSrc).toMatch(/team\.age_group/);
    // Meta + tabs both sit under the title row in the header block
    expect(qcSrc).toMatch(/TeamDetailHeaderMenus[\s\S]*\{fullHeaderMetaLine\}[\s\S]*\{headerBelow/);
  });

  test('large chip tokens are removed from shared styles', () => {
    expect(stylesSrc).not.toMatch(/LIST_FILTER_CHIP_LG_/);
    expect(stylesSrc).toMatch(/export const LIST_FILTER_CHIP_CLASS/);
    expect(stylesSrc).toMatch(/export const LIST_FILTER_CHIP_ACTIVE_CLASS/);
  });

  test('activity tab renders DetailActivityLog when selected', () => {
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/teams\.tabs\.activity/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="team"/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
  });
});
