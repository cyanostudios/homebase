// plugins/teams/services/externalTeamOptionsService.js
// Lists unique FOGIS teams for TeamForm mapping (Teams-owned).

const { Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const {
  fetchUpcomingGames,
  sanitizeExternalTeamId,
} = require('../../matches/services/svffFogisClient');

const AGE_HINT_RE = /\b([FP]\d{1,2}|U\d{1,2})\b/gi;
const MAX_AGE_HINTS = 5;

/**
 * Extract youth/age codes (F16, P17, U15, …) from competition / team text.
 * @param {...unknown} texts
 * @returns {string[]}
 */
function extractAgeHints(...texts) {
  const found = new Set();
  for (const text of texts) {
    const raw = String(text || '');
    if (!raw.trim()) continue;
    AGE_HINT_RE.lastIndex = 0;
    let match;
    while ((match = AGE_HINT_RE.exec(raw)) !== null) {
      found.add(match[1].toUpperCase());
    }
  }
  return Array.from(found);
}

function mergeAgeHints(existingHints, nextHints) {
  const set = new Set(existingHints || []);
  for (const hint of nextHints || []) {
    set.add(hint);
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, 'sv', { numeric: true, sensitivity: 'base' }))
    .slice(0, MAX_AGE_HINTS);
}

/**
 * Aggregate unique FOGIS teams from raw upcoming-games payloads.
 * Counts each game at most once per external team id.
 * Collects ageHints from competition fields and team names.
 */
function aggregateExternalTeams(games) {
  const byId = new Map();

  for (const game of Array.isArray(games) ? games : []) {
    const competitionTexts = [game?.competitionCategoryName, game?.competitionName];
    const sides = [
      { id: game?.homeTeamId, name: game?.homeTeamName },
      { id: game?.awayTeamId, name: game?.awayTeamName },
    ];
    const seenInGame = new Set();

    for (const side of sides) {
      const externalTeamId = sanitizeExternalTeamId(side.id);
      if (!externalTeamId || seenInGame.has(externalTeamId)) {
        continue;
      }
      seenInGame.add(externalTeamId);

      const name = String(side.name || '').trim();
      const hintsFromGame = extractAgeHints(...competitionTexts, name);
      const existing = byId.get(externalTeamId);
      if (existing) {
        existing.matchCount += 1;
        if (!existing.name && name) {
          existing.name = name;
        }
        existing.ageHints = mergeAgeHints(existing.ageHints, hintsFromGame);
      } else {
        byId.set(externalTeamId, {
          externalTeamId,
          name: name || externalTeamId,
          matchCount: 1,
          ageHints: mergeAgeHints([], hintsFromGame),
        });
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'sv', { sensitivity: 'base' }),
  );
}

async function listOccupiedExternalTeamIds(req) {
  const db = Database.get(req);
  const rows = await db.query(
    `SELECT id, name, external_team_id
     FROM teams
     WHERE external_team_id IS NOT NULL
       AND TRIM(external_team_id) <> ''`,
    [],
  );

  return (rows || [])
    .map((row) => {
      const externalTeamId = sanitizeExternalTeamId(row.external_team_id);
      if (!externalTeamId) return null;
      return {
        externalTeamId,
        teamId: String(row.id),
        teamName: String(row.name || '').trim() || String(row.id),
      };
    })
    .filter(Boolean);
}

async function getExternalOptions(req) {
  const userId = req.session?.currentTenantUserId || req.session?.user?.id;
  if (!userId) {
    throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
  }

  const games = await fetchUpcomingGames(userId);
  const [externalTeams, occupiedBy] = await Promise.all([
    Promise.resolve(aggregateExternalTeams(games)),
    listOccupiedExternalTeamIds(req),
  ]);

  return { externalTeams, occupiedBy };
}

module.exports = {
  aggregateExternalTeams,
  extractAgeHints,
  getExternalOptions,
  listOccupiedExternalTeamIds,
};
