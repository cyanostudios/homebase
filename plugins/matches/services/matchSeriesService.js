// plugins/matches/services/matchSeriesService.js
// Series overview: FOGIS team-standings + derived table from imported matches.

const { AppError } = require('../../../server/core/errors/AppError');
const { sanitizeExternalTeamId, fetchTeamStandings } = require('./svffFogisClient');

function toIntOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyStandingRow(teamName, teamId = null) {
  return {
    position: null,
    teamId: teamId != null ? String(teamId) : null,
    teamName: String(teamName || '').trim() || 'Unknown',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    isOwnClub: false,
  };
}

function applyMatchToStanding(row, goalsFor, goalsAgainst) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
  row.goalDifference = row.goalsFor - row.goalsAgainst;
}

function sortStandings(rows) {
  return [...rows]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamName.localeCompare(b.teamName, 'sv', { sensitivity: 'base' });
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

/**
 * Build a league table from finished imported matches (partial: only games we have).
 * @param {Array<object>} matches
 * @param {{ ownTeamNames?: Set<string> }} [options]
 */
function deriveStandingsFromMatches(matches, options = {}) {
  const ownNames = options.ownTeamNames || new Set();
  const byName = new Map();

  const getRow = (name) => {
    const key = String(name || '').trim();
    if (!key) return null;
    let row = byName.get(key.toLowerCase());
    if (!row) {
      row = emptyStandingRow(key);
      byName.set(key.toLowerCase(), row);
    }
    return row;
  };

  for (const match of matches || []) {
    if (match?.is_canceled || match?.is_postponed) continue;
    const homeScore = toIntOrNull(match.home_score);
    const awayScore = toIntOrNull(match.away_score);
    if (homeScore == null || awayScore == null) continue;
    if (homeScore < 0 || awayScore < 0) continue;

    const home = getRow(match.home_team);
    const away = getRow(match.away_team);
    if (!home || !away) continue;

    applyMatchToStanding(home, homeScore, awayScore);
    applyMatchToStanding(away, awayScore, homeScore);
  }

  const rows = [...byName.values()].map((row) => ({
    ...row,
    isOwnClub: [...ownNames].some(
      (own) => own && row.teamName.toLowerCase().startsWith(String(own).toLowerCase()),
    ),
  }));

  return sortStandings(rows);
}

function pickStandingRowsFromExtended(standingsExtended) {
  if (standingsExtended == null) return null;
  if (Array.isArray(standingsExtended)) return standingsExtended;
  if (typeof standingsExtended !== 'object') return null;

  const candidates = [
    standingsExtended.standings,
    standingsExtended.standing,
    standingsExtended.rows,
    standingsExtended.teams,
    standingsExtended.table,
    standingsExtended.items,
    standingsExtended.data,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function mapFogisStandingRow(raw, index, ownTeamIds, ownTeamNames) {
  const teamId = raw?.teamId != null ? String(raw.teamId) : raw?.id != null ? String(raw.id) : null;
  const teamName = String(raw?.teamName || raw?.name || raw?.team || raw?.clubName || '').trim();
  const played = toIntOrNull(raw?.played ?? raw?.gamesPlayed ?? raw?.gp) ?? 0;
  const won = toIntOrNull(raw?.won ?? raw?.wins ?? raw?.w) ?? 0;
  const drawn = toIntOrNull(raw?.drawn ?? raw?.draws ?? raw?.d ?? raw?.tied) ?? 0;
  const lost = toIntOrNull(raw?.lost ?? raw?.losses ?? raw?.l) ?? 0;
  const goalsFor = toIntOrNull(raw?.goalsFor ?? raw?.gf ?? raw?.scored ?? raw?.for) ?? 0;
  const goalsAgainst =
    toIntOrNull(raw?.goalsAgainst ?? raw?.ga ?? raw?.conceded ?? raw?.against) ?? 0;
  const points = toIntOrNull(raw?.points ?? raw?.pts) ?? won * 3 + drawn;
  const position = toIntOrNull(raw?.position ?? raw?.rank ?? raw?.place) ?? index + 1;
  const isOwnClub =
    (teamId && ownTeamIds.has(String(teamId))) ||
    [...ownTeamNames].some(
      (own) => own && teamName.toLowerCase().startsWith(String(own).toLowerCase()),
    );

  return {
    position,
    teamId,
    teamName: teamName || 'Unknown',
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
    isOwnClub,
  };
}

function mapFogisStandings(standingsExtended, ownTeamIds, ownTeamNames) {
  const rows = pickStandingRowsFromExtended(standingsExtended);
  if (!rows) return null;
  return rows.map((row, index) => mapFogisStandingRow(row, index, ownTeamIds, ownTeamNames));
}

function mapCompetitionEngagement(engagement, { ownTeamIds, ownTeamNames, derivedByCompetition }) {
  const competition = engagement?.competition || {};
  const name = String(competition.name || '').trim();
  const fogisStandings = mapFogisStandings(engagement?.standingsExtended, ownTeamIds, ownTeamNames);
  const derived = name ? derivedByCompetition.get(name.toLowerCase()) || [] : [];

  let standingsSource = 'none';
  let standings = [];
  if (fogisStandings && fogisStandings.length > 0) {
    standingsSource = 'fogis';
    standings = fogisStandings;
  } else if (derived.length > 0) {
    standingsSource = 'derived';
    standings = derived;
  }

  return {
    competitionId: toIntOrNull(competition.competitionId),
    competitionNumber:
      competition.competitionNumber != null ? String(competition.competitionNumber) : null,
    name: name || null,
    seasonId: toIntOrNull(competition.seasonId),
    isActive: Boolean(competition.isActive),
    competitionTypeName:
      competition.competitionTypeName != null ? String(competition.competitionTypeName) : null,
    categoryName: competition.categoryName != null ? String(competition.categoryName) : null,
    statusName: competition.statusName != null ? String(competition.statusName) : null,
    standingsSource,
    standings,
  };
}

/**
 * @param {object} req
 * @param {{ teamId: string|number, seasonIds?: string|number }} options
 */
async function getSeriesForTeam(req, { teamId, seasonIds } = {}) {
  const homebaseTeamId = Number(teamId);
  if (!Number.isFinite(homebaseTeamId) || homebaseTeamId < 1) {
    throw new AppError('Valid teamId is required', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const { Database } = require('@homebase/core');
  const db = Database.get(req);

  // Tenant Database.query returns a row array (not pg { rows }).
  const teamRows = await db.query(`SELECT id, name, external_team_id FROM teams WHERE id = $1`, [
    homebaseTeamId,
  ]);
  const team = Array.isArray(teamRows) ? teamRows[0] : null;
  if (!team) {
    throw new AppError('Team not found', 404, AppError.CODES.NOT_FOUND);
  }

  const externalTeamId = sanitizeExternalTeamId(team.external_team_id);
  if (!externalTeamId) {
    throw new AppError(
      'Team has no FOGIS link. Set external team ID on the team first.',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }

  const matchRows = await db.query(
    `SELECT id, home_team, away_team, home_score, away_score, result, competition_name,
            is_canceled, is_finished, is_postponed, start_time, team_id
     FROM matches
     WHERE team_id = $1`,
    [homebaseTeamId],
  );
  const teamMatches = Array.isArray(matchRows) ? matchRows : [];

  const fogisPayload = await fetchTeamStandings(
    req.session?.currentTenantUserId || req.session?.user?.id,
    externalTeamId,
    { seasonIds },
  );
  const fogisTeam = fogisPayload?.team || {};
  const engagements = Array.isArray(fogisTeam.teamEngagementsWithStandings)
    ? fogisTeam.teamEngagementsWithStandings
    : [];

  const ownTeamIds = new Set([externalTeamId]);
  const ownTeamNames = new Set(
    [team.name, fogisTeam.name, fogisTeam.clubName, fogisTeam.shortName]
      .map((n) => String(n || '').trim())
      .filter(Boolean),
  );

  const derivedByCompetition = new Map();
  const matchesByCompetition = new Map();
  for (const match of teamMatches) {
    const comp = String(match.competition_name || '').trim();
    if (!comp) continue;
    const key = comp.toLowerCase();
    if (!matchesByCompetition.has(key)) matchesByCompetition.set(key, []);
    matchesByCompetition.get(key).push(match);
  }
  for (const [key, list] of matchesByCompetition.entries()) {
    derivedByCompetition.set(key, deriveStandingsFromMatches(list, { ownTeamNames }));
  }

  const competitions = engagements
    .map((engagement) =>
      mapCompetitionEngagement(engagement, {
        ownTeamIds,
        ownTeamNames,
        derivedByCompetition,
      }),
    )
    .filter((c) => c.name)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'sv', { sensitivity: 'base' });
    });

  // Include competitions present only in imported matches (not in FOGIS engagements).
  const knownNames = new Set(competitions.map((c) => c.name.toLowerCase()));
  for (const [key, standings] of derivedByCompetition.entries()) {
    if (knownNames.has(key)) continue;
    const sample = matchesByCompetition.get(key)?.[0];
    competitions.push({
      competitionId: null,
      competitionNumber: null,
      name: sample?.competition_name || key,
      seasonId: null,
      isActive: false,
      competitionTypeName: null,
      categoryName: null,
      statusName: null,
      standingsSource: standings.length > 0 ? 'derived' : 'none',
      standings,
    });
  }

  return {
    teamId: String(team.id),
    teamName: team.name,
    externalTeamId,
    fogisTeamName: fogisTeam.name != null ? String(fogisTeam.name) : null,
    competitions,
    matches: teamMatches.map((row) => ({
      id: String(row.id),
      home_team: row.home_team,
      away_team: row.away_team,
      home_score: row.home_score != null ? Number(row.home_score) : null,
      away_score: row.away_score != null ? Number(row.away_score) : null,
      result: row.result != null ? String(row.result) : null,
      competition_name: row.competition_name != null ? String(row.competition_name) : null,
      start_time: row.start_time,
      is_canceled: Boolean(row.is_canceled),
      is_finished: Boolean(row.is_finished),
      is_postponed: Boolean(row.is_postponed),
    })),
  };
}

module.exports = {
  deriveStandingsFromMatches,
  mapFogisStandings,
  getSeriesForTeam,
};
