const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../SiteAuditList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../SiteAuditListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../SiteAuditView.tsx'), 'utf8');
const providerSrc = fs.readFileSync(
  path.join(__dirname, '../../context/SiteAuditsProvider.tsx'),
  'utf8',
);
const menusSrc = fs.readFileSync(path.join(__dirname, '../SiteAuditDetailHeaderMenus.tsx'), 'utf8');
const overviewSrc = fs.readFileSync(path.join(__dirname, '../SiteAuditRunOverview.tsx'), 'utf8');
const enLocale = fs.readFileSync(path.join(__dirname, '../../../../i18n/locales/en.json'), 'utf8');
const svLocale = fs.readFileSync(path.join(__dirname, '../../../../i18n/locales/sv.json'), 'utf8');

describe('SiteAuditList table view wiring', () => {
  test('list uses the mail-layout 20/80 split with a table-only identity column', () => {
    expect(listSrc).toMatch(/SiteAuditListTable/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/ListEmptyState/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
    expect(listSrc).toMatch(/usePersistedListSearch\('site-audits'\)/);
  });

  test('list has no Settings entry point in etapp 1', () => {
    expect(listSrc).not.toMatch(/openSiteAuditsSettings/);
    expect(listSrc).not.toMatch(/SiteAuditsSettingsView/);
    expect(listSrc).not.toMatch(/contentView === 'settings'/);
  });

  test('list has no list-tags UI', () => {
    expect(listSrc).not.toMatch(/ItemTagsField/);
    expect(listSrc).not.toMatch(/listTagFilter/);
    expect(listSrc).not.toMatch(/usePluginListTags/);
  });

  test('list previews sites inline and renders the form/view/statistics stack', () => {
    expect(listSrc).toMatch(/previewItem/);
    expect(listSrc).toMatch(/SiteAuditView/);
    expect(listSrc).toMatch(/SiteAuditForm/);
    expect(listSrc).toMatch(/SiteAuditsStatisticsView/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
  });

  test('desktop create/edit renders SiteAuditForm inline with Save/Cancel actions', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isSiteAuditPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveSiteAudit/);
    expect(listSrc).toMatch(/closeSiteAuditPanel/);
  });

  test('bulk selection and delete reuse the shared BulkActionRoundBar / BulkDeleteModal', () => {
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/BulkDeleteModal/);
    expect(listSrc).toMatch(/deleteSiteAudits/);
    expect(listSrc).toMatch(/useShiftRangeListSelection/);
  });

  test('table uses SortableListTable with a single identity column (name + meta row)', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/getSiteAuditHostname/);
    expect(tableSrc).toMatch(/formatSiteAuditScore/);
    expect(tableSrc).toMatch(/formatSiteAuditRelativeTime/);
    expect(tableSrc).toMatch(/pluginName="site-audits"/);
    expect(tableSrc).not.toMatch(/field: 'url'/);
    expect(tableSrc).not.toMatch(/field: 'competitorUrl'/);
  });

  test('detail view exposes category tabs overview | quickWins | seo | ai | security | pages | technical | …', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/'overview'/);
    expect(viewSrc).toMatch(/'quickWins'/);
    expect(viewSrc).toMatch(/'seo'/);
    expect(viewSrc).toMatch(/'ai'/);
    expect(viewSrc).toMatch(/'security'/);
    expect(viewSrc).toMatch(/'pages'/);
    expect(viewSrc).toMatch(/'technical'/);
    expect(viewSrc).toMatch(/SiteAuditFindingsPanel/);
    expect(viewSrc).toMatch(/SiteAuditOutboundUrl/);
    expect(viewSrc).toMatch(/SiteAuditTechnicalView/);
    const outboundSrc = fs.readFileSync(
      path.join(__dirname, '../SiteAuditOutboundUrl.tsx'),
      'utf8',
    );
    expect(outboundSrc).toMatch(/isSafeSiteAuditHttpUrl/);
    expect(outboundSrc).toMatch(/target="_blank"/);
    expect(outboundSrc).toMatch(/noopener noreferrer/);
    expect(outboundSrc).toMatch(/ExternalLink/);
    expect(viewSrc).toMatch(/SITE_AUDIT_TECHNICAL_SECURITY_SECTIONS/);
    expect(viewSrc).toMatch(/SITE_AUDIT_TECHNICAL_INFRA_SECTIONS/);
    const technicalSrc = fs.readFileSync(
      path.join(__dirname, '../SiteAuditTechnicalView.tsx'),
      'utf8',
    );
    expect(technicalSrc).not.toMatch(/dangerouslySetInnerHTML/);
    expect(technicalSrc).toMatch(
      /SITE_AUDIT_TECHNICAL_INFRA_SECTIONS:\s*SiteAuditTechnicalSection\[\]\s*=\s*\[\s*'technologies',\s*'resources'/,
    );
    expect(technicalSrc).toMatch(/siteAudits\.technical\.technologies\.empty/);
    const findingsPanelSrc = fs.readFileSync(
      path.join(__dirname, '../SiteAuditFindingsPanel.tsx'),
      'utf8',
    );
    expect(findingsPanelSrc).not.toMatch(/dangerouslySetInnerHTML/);
    expect(viewSrc).toMatch(/'compare'/);
    expect(viewSrc).toMatch(/'history'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="site-audit"/);
    expect(viewSrc).not.toMatch(/entityType="site-audits"/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);

    for (const locale of [enLocale, svLocale]) {
      const siteAudits = JSON.parse(locale).siteAudits;
      expect(siteAudits.tabs.quickWins).toEqual(expect.any(String));
      expect(siteAudits.tabs.seo).toEqual(expect.any(String));
      expect(siteAudits.tabs.ai).toEqual(expect.any(String));
      expect(siteAudits.tabs.security).toEqual(expect.any(String));
      expect(siteAudits.tabs.technical).toEqual(expect.any(String));
      expect(siteAudits.technical.sections.headers).toEqual(expect.any(String));
      expect(siteAudits.technical.sections.tls).toEqual(expect.any(String));
      expect(siteAudits.technical.sections.dns).toEqual(expect.any(String));
      expect(siteAudits.technical.sections.technologies).toEqual(expect.any(String));
      expect(siteAudits.technical.sections.resources).toEqual(expect.any(String));
      expect(siteAudits.technical.technologies.empty).toEqual(expect.any(String));
      expect(siteAudits.technical.technologies.categories.cms).toEqual(expect.any(String));
      expect(siteAudits.technical.sections.crawl).toEqual(expect.any(String));
    }
  });

  test('failed delete stays open and shows siteAudits.errors.deleteFailed', () => {
    const deleteFns = providerSrc.slice(
      providerSrc.indexOf('const deleteSiteAudit'),
      providerSrc.indexOf('const startSiteAuditRun'),
    );
    expect(deleteFns).toMatch(/Failed to delete site audit:[\s\S]*?throw err/);
    expect(deleteFns).toMatch(/Failed to bulk delete site audits:[\s\S]*?throw err/);
    expect(deleteFns).not.toMatch(/finally/);
    expect(menusSrc).toMatch(/siteAudits\.errors\.deleteFailed/);
    expect(listSrc).toMatch(/warningMessage=\{bulkDeleteError/);
  });

  test('overview is score-only; findings live on category tabs via SiteAuditFindingsPanel', () => {
    expect(overviewSrc).toMatch(/siteAudits\.overallScore/);
    expect(overviewSrc).toMatch(/SITE_AUDIT_CATEGORY_IDS/);
    expect(overviewSrc).not.toMatch(/selectSiteAuditQuickWins/);
    expect(overviewSrc).not.toMatch(/selectSiteAuditPillarFindings/);
    expect(overviewSrc).not.toMatch(/SiteAuditFindingsPanel/);
    expect(overviewSrc).not.toMatch(/TOP_FINDINGS_LIMIT/);
    expect(overviewSrc).not.toMatch(/dangerouslySetInnerHTML/);

    const findingsPanelSrc = fs.readFileSync(
      path.join(__dirname, '../SiteAuditFindingsPanel.tsx'),
      'utf8',
    );
    expect(findingsPanelSrc).toMatch(/selectSiteAuditQuickWins/);
    expect(findingsPanelSrc).toMatch(/selectSiteAuditPillarFindings/);
    expect(findingsPanelSrc).toMatch(/\{finding\.message\}/);
    expect(findingsPanelSrc).toMatch(/siteAudits\.sectionMeta\./);
    expect(findingsPanelSrc).not.toMatch(/TOP_FINDINGS_LIMIT/);

    for (const locale of [enLocale, svLocale]) {
      const siteAudits = JSON.parse(locale).siteAudits;
      expect(siteAudits.quickWins).toEqual(expect.any(String));
      expect(siteAudits.emptyQuickWins).toEqual(expect.any(String));
      expect(siteAudits.sectionMeta.none).toEqual(expect.any(String));
      expect(siteAudits.pillars.seo).toEqual(expect.any(String));
      expect(siteAudits.pillars.ai).toEqual(expect.any(String));
      expect(siteAudits.pillars.security).toEqual(expect.any(String));
      expect(siteAudits.pillars.empty).toEqual(expect.any(String));
    }
  });

  test('detail view polls active runs and surfaces Run audit via the quick context panel', () => {
    expect(viewSrc).toMatch(/POLL_INTERVAL_MS = 2000/);
    expect(viewSrc).toMatch(/isSiteAuditRunActive/);
    expect(viewSrc).toMatch(/startSiteAuditRun/);
    expect(viewSrc).toMatch(/SiteAuditQuickContextPanel/);
    expect(viewSrc).toMatch(/SiteAuditRunOverview/);
    expect(viewSrc).toMatch(/handleStopAudit/);
    expect(viewSrc).toMatch(/cancelSiteAuditRun/);
    expect(viewSrc).toMatch(/siteAudits\.runDuration/);
    expect(viewSrc).toMatch(/formatSiteAuditDuration/);
    expect(viewSrc).toMatch(/siteAudits\.pagesCrawled/);
    expect(viewSrc).toMatch(/filterSiteAuditPages/);
    expect(viewSrc).toMatch(/SiteAuditPageFilterTags/);
    expect(viewSrc).toMatch(/pageIncludeTags/);
    expect(viewSrc).toMatch(/pageExcludeTags/);
    expect(viewSrc).toMatch(/max-h-\[min\(60vh,32rem\)\] overflow-auto/);
    expect(viewSrc).toMatch(/sticky top-0/);
    expect(viewSrc).toMatch(/siteAudits\.pagesIncludeLabel/);
    expect(viewSrc).toMatch(/siteAudits\.pagesExcludeLabel/);
    expect(viewSrc).toMatch(/siteAudits\.pagesAllFiltered/);
    expect(viewSrc).toMatch(/sortSiteAuditPages/);
    expect(viewSrc).toMatch(/handlePageSort/);
    expect(viewSrc).toMatch(/ListTableSortIcon/);
    expect(viewSrc).toMatch(/SiteAuditPageFindingsIcons/);
    expect(viewSrc).toMatch(/siteAudits\.pageFindings/);
    expect(listSrc).not.toMatch(/SiteAuditDetailHeaderMenus/);

    for (const locale of [enLocale, svLocale]) {
      const siteAudits = JSON.parse(locale).siteAudits;
      expect(siteAudits.pagesCrawled_one).toEqual(expect.any(String));
      expect(siteAudits.pagesCrawled_other).toEqual(expect.any(String));
      expect(siteAudits.pagesCrawledFiltered).toEqual(expect.any(String));
      expect(siteAudits.pagesIncludeLabel).toEqual(expect.any(String));
      expect(siteAudits.pagesIncludePlaceholder).toEqual(expect.any(String));
      expect(siteAudits.pagesExcludeLabel).toEqual(expect.any(String));
      expect(siteAudits.pagesExcludePlaceholder).toEqual(expect.any(String));
      expect(siteAudits.pagesAllFiltered).toEqual(expect.any(String));
      expect(siteAudits.pageFindings).toEqual(expect.any(String));
      expect(siteAudits.stopAuditWithTime).toEqual(expect.any(String));
      expect(siteAudits.runDuration).toEqual(expect.any(String));
      expect(siteAudits.runStatus.cancelled).toEqual(expect.any(String));
      expect(siteAudits.errors.cancelFailed).toEqual(expect.any(String));
    }
  });
});
