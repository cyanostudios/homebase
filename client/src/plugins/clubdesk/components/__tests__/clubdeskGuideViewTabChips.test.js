const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskView.tsx'), 'utf8');

describe('ClubdeskGuideView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('header card always mounts ClubdeskDetailHeaderMenus with tab chips below', () => {
    expect(viewSrc).toMatch(/ClubdeskDetailHeaderMenus/);
    expect(viewSrc).toMatch(/DetailHeaderMetaRow/);
    expect(viewSrc).toMatch(/StatusOutlineBadge/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).not.toMatch(/sidebar=\{/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseClubdeskGuideViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/value === 'properties'/); // legacy ?tab=properties → information
    expect(viewSrc).toMatch(/'steps'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'information' \? propertiesCard/);
    // properties content still on information
    expect(viewSrc).not.toMatch(/activeTab === 'properties'/);
    expect(viewSrc).toMatch(/activeTab === 'steps'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
  });

  test('properties card on information hosts publication and featured controls', () => {
    expect(viewSrc).toMatch(/ClubdeskPublicationPropertiesFields/);
    expect(viewSrc).toMatch(/updateClubdeskPublicationStatus/);
    expect(viewSrc).toMatch(/updateClubdeskFeatured/);
    expect(viewSrc).toMatch(/clubdesk\.guideProperties/);
    expect(viewSrc).toMatch(/t\('clubdesk\.guideProperties'\)/);
    expect(viewSrc).toMatch(/showCategory/);
  });

  test('steps tab count uses steps.length', () => {
    expect(viewSrc).toMatch(/steps\.length/);
    expect(viewSrc).toMatch(/count: stepsCount/);
  });

  test('section titles use i18n tab keys', () => {
    expect(viewSrc).toMatch(/t\('clubdesk\.tabs\.information'\)/);
    expect(viewSrc).toMatch(/t\('clubdesk\.tabs\.steps'\)/);
  });

  test('activity tab renders DetailActivityLog when selected', () => {
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/clubdesk\.tabs\.activity/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="clubdesk"/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
  });
});
