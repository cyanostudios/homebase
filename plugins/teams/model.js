// plugins/teams/model.js
// V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

const TEAM_STATUSES = ['active', 'dormant', 'break'];
const TEAM_GENDERS = ['boys', 'girls', 'mixed'];
const TEAM_PLAYING_FORMATS = ['3v3', '5v5', '7v7', '9v9', '11v11'];
const TEAM_COLORS = [
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

/** Undo express-validator .escape() layers saved before plainString migration. */
function decodeHtmlEntities(raw) {
  if (raw === null || raw === undefined) return raw;
  let out = String(raw);
  for (let i = 0; i < 6; i++) {
    const next = out
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#x2F;/gi, '/')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    if (next === out) break;
    out = next;
  }
  return out;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sanitizeTrainingVenueId(value) {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.length > 20) return undefined;
  if (!/^[1-9]\d*$/.test(trimmed)) return undefined;
  return trimmed;
}

function sanitizeTrainingTimes(value) {
  return parseJsonArray(value)
    .filter((t) => t && typeof t === 'object')
    .map((t) => {
      const item = {
        day: String(t.day ?? '').slice(0, 20),
        startTime: String(t.startTime ?? '').slice(0, 10),
        endTime: String(t.endTime ?? '').slice(0, 10),
        location: String(t.location ?? '').slice(0, 255),
        countsTowardCapacity: t.countsTowardCapacity === false ? false : true,
      };
      const venueId = sanitizeTrainingVenueId(t.venueId);
      if (venueId !== undefined) {
        item.venueId = venueId;
      }
      return item;
    })
    .slice(0, 50);
}

function sanitizeSeasonBreaks(value) {
  return parseJsonArray(value)
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      name: String(b.name ?? '').slice(0, 255),
      startDate: String(b.startDate ?? '').slice(0, 10),
      endDate: String(b.endDate ?? '').slice(0, 10),
    }))
    .slice(0, 50);
}

/** Append-only { at, count } snapshots for player growth chart. Server-owned. */
function sanitizePlayerCountHistory(value) {
  return parseJsonArray(value)
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      const at = String(e.at ?? '')
        .trim()
        .slice(0, 40);
      if (!at) return null;
      const count = toIntOrDefault(e.count, 0);
      return { at, count: Math.max(0, Math.min(9999, count)) };
    })
    .filter(Boolean)
    .slice(0, 500);
}

function seedPlayerCountHistory(count, atIso) {
  return [
    {
      at: atIso || new Date().toISOString(),
      count: Math.max(0, Math.min(9999, toIntOrDefault(count, 0))),
    },
  ];
}

function appendPlayerCountHistory(existingRaw, nextCount, atIso) {
  const history = sanitizePlayerCountHistory(existingRaw);
  const next = Math.max(0, Math.min(9999, toIntOrDefault(nextCount, 0)));
  const at = atIso || new Date().toISOString();
  if (history.length === 0) {
    return [{ at, count: next }];
  }
  const last = history[history.length - 1];
  if (last.count === next) return history;
  return [...history, { at, count: next }].slice(0, 500);
}

function sanitizeSeriesTeams(value) {
  return parseJsonArray(value)
    .filter((st) => st && typeof st === 'object')
    .map((st) => ({
      name: decodeHtmlEntities(String(st.name ?? '').trim()).slice(0, 255),
      level:
        st.level != null && String(st.level).trim()
          ? decodeHtmlEntities(String(st.level).trim()).slice(0, 100)
          : null,
      color: TEAM_COLORS.includes(st.color) ? st.color : null,
    }))
    .filter((st) => st.name || st.level)
    .slice(0, 50);
}

function sanitizeResponsibles(value) {
  return parseJsonArray(value)
    .filter((r) => r && typeof r === 'object' && r.contactId != null)
    .map((r) => ({
      contactId: String(r.contactId).slice(0, 50),
      role: String(r.role ?? 'other').slice(0, 50),
      seriesTeam:
        r.seriesTeam != null && String(r.seriesTeam).trim()
          ? decodeHtmlEntities(String(r.seriesTeam).trim()).slice(0, 255)
          : null,
    }))
    .slice(0, 100);
}

function sanitizeTeamNotes(value) {
  return parseJsonArray(value)
    .filter((n) => n && typeof n === 'object' && String(n.text ?? '').trim())
    .map((n) => ({
      id: String(n.id ?? `note-${Date.now()}`).slice(0, 64),
      text: decodeHtmlEntities(String(n.text ?? '').trim()).slice(0, 10000),
      createdAt: n.createdAt ? String(n.createdAt).slice(0, 30) : new Date().toISOString(),
    }))
    .slice(0, 200);
}

function toIntOrDefault(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function stableJson(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }
  return JSON.stringify(value);
}

function sanitizeExternalTeamId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 100) : null;
}

async function assertExternalTeamIdAvailable(db, externalTeamId, excludeTeamId = null) {
  if (!externalTeamId) return;

  const params = [externalTeamId];
  let sql = 'SELECT id, name FROM teams WHERE external_team_id = $1';
  if (excludeTeamId != null && String(excludeTeamId).trim() !== '') {
    sql += ' AND id <> $2';
    params.push(Number(excludeTeamId));
  }
  sql += ' LIMIT 1';

  const rows = await db.query(sql, params);
  if (rows && rows.length > 0) {
    const occupiedName = rows[0].name ? String(rows[0].name) : String(rows[0].id);
    throw new AppError(
      `External team ID is already linked to "${occupiedName}"`,
      409,
      AppError.CODES.CONFLICT,
    );
  }
}

class TeamModel {
  static getChangeSummary(existing, teamData) {
    const labels = {
      name: 'Name',
      age_group: 'Age group',
      gender: 'Gender',
      playing_format: 'Playing format',
      player_count: 'Players',
      series_teams: 'Series teams',
      series_team_count: 'Series teams',
      status: 'Status',
      status_note: 'Status note',
      team_notes: 'Notes',
      training_times: 'Training schedule',
      season_breaks: 'Season breaks',
      responsibles: 'Responsibles',
      color: 'Color',
      external_team_id: 'External team ID',
    };
    const changed = [];

    if ('name' in teamData) {
      const next = decodeHtmlEntities((teamData.name || '').toString().trim());
      const prev = decodeHtmlEntities((existing.name || '').toString().trim());
      if (next !== prev) changed.push(labels.name);
    }
    if ('age_group' in teamData) {
      const next = decodeHtmlEntities((teamData.age_group || '').trim()) || null;
      const prev =
        existing.age_group != null ? decodeHtmlEntities(String(existing.age_group).trim()) : null;
      if (next !== prev) changed.push(labels.age_group);
    }
    if ('gender' in teamData) {
      const next = TEAM_GENDERS.includes(teamData.gender) ? teamData.gender : null;
      const prev = existing.gender ?? null;
      if (next !== prev) changed.push(labels.gender);
    }
    if ('playing_format' in teamData) {
      const next = TEAM_PLAYING_FORMATS.includes(teamData.playing_format)
        ? teamData.playing_format
        : null;
      const prev = existing.playing_format ?? null;
      if (next !== prev) changed.push(labels.playing_format);
    }
    if ('player_count' in teamData) {
      const next = toIntOrDefault(teamData.player_count, 0);
      const prev = existing.player_count != null ? Number(existing.player_count) : 0;
      if (next !== prev) changed.push(labels.player_count);
    }
    if ('series_teams' in teamData) {
      if (
        stableJson(sanitizeSeriesTeams(teamData.series_teams)) !==
        stableJson(sanitizeSeriesTeams(existing.series_teams))
      ) {
        changed.push(labels.series_teams);
      }
    } else if ('series_team_count' in teamData) {
      const next = toIntOrDefault(teamData.series_team_count, 0);
      const prev = existing.series_team_count != null ? Number(existing.series_team_count) : 0;
      if (next !== prev) changed.push(labels.series_team_count);
    }
    if ('status' in teamData) {
      const next = TEAM_STATUSES.includes(teamData.status) ? teamData.status : 'active';
      const prev = existing.status || 'active';
      if (next !== prev) changed.push(labels.status);
    }
    if ('status_note' in teamData) {
      const next = decodeHtmlEntities((teamData.status_note || '').trim()) || null;
      const prev =
        existing.status_note != null
          ? decodeHtmlEntities(String(existing.status_note).trim())
          : null;
      if (next !== prev) changed.push(labels.status_note);
    }
    if ('team_notes' in teamData) {
      if (
        stableJson(sanitizeTeamNotes(teamData.team_notes)) !==
        stableJson(sanitizeTeamNotes(existing.team_notes))
      ) {
        changed.push(labels.team_notes);
      }
    }
    if ('training_times' in teamData) {
      if (
        stableJson(sanitizeTrainingTimes(teamData.training_times)) !==
        stableJson(sanitizeTrainingTimes(existing.training_times))
      ) {
        changed.push(labels.training_times);
      }
    }
    if ('season_breaks' in teamData) {
      if (
        stableJson(sanitizeSeasonBreaks(teamData.season_breaks)) !==
        stableJson(sanitizeSeasonBreaks(existing.season_breaks))
      ) {
        changed.push(labels.season_breaks);
      }
    }
    if ('responsibles' in teamData) {
      if (
        stableJson(sanitizeResponsibles(teamData.responsibles)) !==
        stableJson(sanitizeResponsibles(existing.responsibles))
      ) {
        changed.push(labels.responsibles);
      }
    }
    if ('color' in teamData) {
      const next = TEAM_COLORS.includes(teamData.color) ? teamData.color : 'green';
      const prev = existing.color || 'green';
      if (next !== prev) changed.push(labels.color);
    }
    if ('external_team_id' in teamData) {
      const next = sanitizeExternalTeamId(teamData.external_team_id);
      const prev = sanitizeExternalTeamId(existing.external_team_id);
      if (next !== prev) changed.push(labels.external_team_id);
    }

    return changed.length === 0 ? null : changed.join(', ');
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM teams ORDER BY name ASC, created_at DESC', []);
      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch teams', error);
      throw new AppError('Failed to fetch teams', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, teamId) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      if (!rows || rows.length === 0) {
        throw new AppError('Team not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to fetch team', error, { teamId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch team', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, teamData) {
    try {
      const db = Database.get(req);
      const {
        name,
        age_group,
        gender,
        playing_format,
        player_count,
        series_team_count,
        series_teams,
        status,
        status_note,
        team_notes,
        training_times,
        season_breaks,
        responsibles,
        color,
        external_team_id,
      } = teamData;

      const trimmedName = decodeHtmlEntities((name || '').toString().trim());
      if (!trimmedName) {
        throw new AppError('Team name is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const sanitizedSeriesTeams =
        series_teams !== undefined ? sanitizeSeriesTeams(series_teams) : [];

      const nextExternalTeamId = sanitizeExternalTeamId(external_team_id);
      await assertExternalTeamIdAvailable(db, nextExternalTeamId, null);

      const initialPlayerCount = toIntOrDefault(player_count, 0);
      const result = await db.insert('teams', {
        name: trimmedName.slice(0, 255),
        age_group: decodeHtmlEntities((age_group || '').trim()) || null,
        gender: TEAM_GENDERS.includes(gender) ? gender : null,
        playing_format: TEAM_PLAYING_FORMATS.includes(playing_format) ? playing_format : null,
        player_count: initialPlayerCount,
        player_count_history: JSON.stringify(seedPlayerCountHistory(initialPlayerCount)),
        series_teams: JSON.stringify(sanitizedSeriesTeams),
        series_team_count:
          series_teams !== undefined
            ? sanitizedSeriesTeams.length
            : toIntOrDefault(series_team_count, 0),
        status: TEAM_STATUSES.includes(status) ? status : 'active',
        status_note: decodeHtmlEntities((status_note || '').trim()) || null,
        team_notes: JSON.stringify(sanitizeTeamNotes(team_notes)),
        training_times: JSON.stringify(sanitizeTrainingTimes(training_times)),
        season_breaks: JSON.stringify(sanitizeSeasonBreaks(season_breaks)),
        responsibles: JSON.stringify(sanitizeResponsibles(responsibles)),
        color: TEAM_COLORS.includes(color) ? color : 'green',
        external_team_id: nextExternalTeamId,
      });

      Logger.info('Team created', { teamId: result.id });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create team', error, { teamData: { name: teamData?.name } });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create team', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, teamId, teamData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        throw new AppError('User context required for update', 401, AppError.CODES.UNAUTHORIZED);
      }

      const existing = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      if (!existing || existing.length === 0) {
        throw new AppError('Team not found', 404, AppError.CODES.NOT_FOUND);
      }
      const current = existing[0];

      const {
        name,
        age_group,
        gender,
        playing_format,
        player_count,
        series_team_count,
        series_teams,
        status,
        status_note,
        team_notes,
        training_times,
        season_breaks,
        responsibles,
        color,
        external_team_id,
      } = teamData;

      const trimmedName = decodeHtmlEntities((name || '').toString().trim());
      if (!trimmedName) {
        throw new AppError('Team name is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const sanitizedSeriesTeams =
        series_teams !== undefined ? sanitizeSeriesTeams(series_teams) : null;

      const changeSummary = TeamModel.getChangeSummary(current, teamData);

      const nextExternalTeamId =
        external_team_id !== undefined
          ? sanitizeExternalTeamId(external_team_id)
          : sanitizeExternalTeamId(current.external_team_id);
      if (external_team_id !== undefined) {
        await assertExternalTeamIdAvailable(db, nextExternalTeamId, teamId);
      }

      const nextPlayerCount =
        player_count !== undefined
          ? toIntOrDefault(player_count, 0)
          : current.player_count != null
            ? Number(current.player_count)
            : 0;
      const prevPlayerCount = current.player_count != null ? Number(current.player_count) : 0;
      let nextPlayerCountHistory = current.player_count_history;
      if (player_count !== undefined && nextPlayerCount !== prevPlayerCount) {
        nextPlayerCountHistory = JSON.stringify(
          appendPlayerCountHistory(current.player_count_history, nextPlayerCount),
        );
      }

      const result = await db.update('teams', teamId, {
        name: trimmedName.slice(0, 255),
        age_group:
          age_group !== undefined
            ? decodeHtmlEntities((age_group || '').trim()) || null
            : (current.age_group ?? null),
        gender:
          gender !== undefined
            ? TEAM_GENDERS.includes(gender)
              ? gender
              : null
            : (current.gender ?? null),
        playing_format:
          playing_format !== undefined
            ? TEAM_PLAYING_FORMATS.includes(playing_format)
              ? playing_format
              : null
            : (current.playing_format ?? null),
        player_count: nextPlayerCount,
        player_count_history: nextPlayerCountHistory,
        series_teams:
          sanitizedSeriesTeams !== null
            ? JSON.stringify(sanitizedSeriesTeams)
            : current.series_teams,
        series_team_count:
          sanitizedSeriesTeams !== null
            ? sanitizedSeriesTeams.length
            : series_team_count !== undefined
              ? toIntOrDefault(series_team_count, 0)
              : (current.series_team_count ?? 0),
        status:
          status !== undefined
            ? TEAM_STATUSES.includes(status)
              ? status
              : 'active'
            : (current.status ?? 'active'),
        status_note:
          status_note !== undefined
            ? decodeHtmlEntities((status_note || '').trim()) || null
            : (current.status_note ?? null),
        team_notes:
          team_notes !== undefined
            ? JSON.stringify(sanitizeTeamNotes(team_notes))
            : current.team_notes,
        training_times:
          training_times !== undefined
            ? JSON.stringify(sanitizeTrainingTimes(training_times))
            : current.training_times,
        season_breaks:
          season_breaks !== undefined
            ? JSON.stringify(sanitizeSeasonBreaks(season_breaks))
            : current.season_breaks,
        responsibles:
          responsibles !== undefined
            ? JSON.stringify(sanitizeResponsibles(responsibles))
            : current.responsibles,
        color:
          color !== undefined
            ? TEAM_COLORS.includes(color)
              ? color
              : 'green'
            : (current.color ?? 'green'),
        external_team_id:
          external_team_id !== undefined ? nextExternalTeamId : (current.external_team_id ?? null),
      });

      Logger.info('Team updated', { teamId });
      const team = this.transformRow(result);
      if (changeSummary) {
        team._changeSummary = changeSummary;
      }
      return team;
    } catch (error) {
      Logger.error('Failed to update team', error, { teamId });
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update team: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async delete(req, teamId) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('teams', teamId);
      Logger.info('Team deleted', { teamId });
      return { id: teamId };
    } catch (error) {
      Logger.error('Failed to delete team', error, { teamId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete team', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      return await BulkOperationsHelper.bulkDelete(req, 'teams', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete teams', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete teams', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformVenueRow(row) {
    return {
      id: String(row.id),
      name: decodeHtmlEntities(row.name ?? ''),
      mapLink: row.map_link != null && String(row.map_link).trim() ? String(row.map_link) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  sanitizeVenueName(value) {
    return decodeHtmlEntities(String(value ?? '').trim()).slice(0, 255);
  }

  sanitizeVenueMapLink(value) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed.slice(0, 2000) : null;
  }

  mapVenueUniqueViolation(error) {
    const code = error?.code || error?.details?.errorCode;
    if (code !== '23505') return null;
    return new AppError('Venue name already exists', 409, AppError.CODES.CONFLICT, [
      { field: 'name', message: 'Venue name already exists' },
    ]);
  }

  async assertVenueNameUnique(db, userId, name, excludeId = null) {
    const params = [userId, name];
    let sql = `
      SELECT id
      FROM team_venues
      WHERE user_id = $1 AND lower(btrim(name)) = lower($2)
    `;
    if (excludeId != null) {
      sql += ' AND id <> $3';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const rows = await db.query(sql, params);
    if (rows && rows.length > 0) {
      throw new AppError('Venue name already exists', 409, AppError.CODES.CONFLICT, [
        { field: 'name', message: 'Venue name already exists' },
      ]);
    }
  }

  async listVenues(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT id, name, map_link, created_at, updated_at
          FROM team_venues
          ORDER BY lower(name) ASC, id ASC
        `,
        [],
      );
      return rows.map((row) => this.transformVenueRow(row));
    } catch (error) {
      Logger.error('Failed to list team venues', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list venues', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createVenue(req, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const name = this.sanitizeVenueName(data?.name);
      if (!name) {
        throw new AppError('Venue name is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'name', message: 'Venue name is required' },
        ]);
      }

      const mapLink = this.sanitizeVenueMapLink(data?.mapLink);

      const countRows = await db.query('SELECT COUNT(*)::int AS c FROM team_venues', []);
      if ((countRows[0]?.c ?? 0) >= 100) {
        throw new AppError('Venue limit reached', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'general', message: 'at most 100 venues allowed' },
        ]);
      }

      await this.assertVenueNameUnique(db, userId, name);

      const result = await db.insert('team_venues', {
        name,
        map_link: mapLink,
      });
      Logger.info('Team venue created', { venueId: result.id });
      return this.transformVenueRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const mapped = this.mapVenueUniqueViolation(error);
      if (mapped) throw mapped;
      Logger.error('Failed to create team venue', error);
      throw new AppError('Failed to create venue', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateVenue(req, venueId, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = parseInt(String(venueId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Venue not found', 404, AppError.CODES.NOT_FOUND);
      }

      const name = this.sanitizeVenueName(data?.name);
      if (!name) {
        throw new AppError('Venue name is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'name', message: 'Venue name is required' },
        ]);
      }

      const mapLink =
        data?.mapLink !== undefined ? this.sanitizeVenueMapLink(data.mapLink) : undefined;

      await this.assertVenueNameUnique(db, userId, name, id);

      const payload = { name };
      if (mapLink !== undefined) {
        payload.map_link = mapLink;
      }

      const result = await db.update('team_venues', id, payload);
      Logger.info('Team venue updated', { venueId: id });
      return this.transformVenueRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const mapped = this.mapVenueUniqueViolation(error);
      if (mapped) throw mapped;
      Logger.error('Failed to update team venue', error, { venueId });
      throw new AppError('Failed to update venue', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteVenue(req, venueId) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = parseInt(String(venueId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Venue not found', 404, AppError.CODES.NOT_FOUND);
      }

      await db.deleteRecord('team_venues', id);
      Logger.info('Team venue deleted', { venueId: id });
      return { id: String(id) };
    } catch (error) {
      Logger.error('Failed to delete team venue', error, { venueId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete venue', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      name: decodeHtmlEntities(row.name),
      age_group: row.age_group != null ? decodeHtmlEntities(row.age_group) : null,
      gender: row.gender ?? null,
      playing_format: TEAM_PLAYING_FORMATS.includes(row.playing_format) ? row.playing_format : null,
      player_count: row.player_count != null ? Number(row.player_count) : 0,
      player_count_history: sanitizePlayerCountHistory(row.player_count_history),
      series_team_count: row.series_team_count != null ? Number(row.series_team_count) : 0,
      series_teams: sanitizeSeriesTeams(row.series_teams),
      status: row.status || 'active',
      status_note: row.status_note != null ? decodeHtmlEntities(row.status_note) : null,
      team_notes: sanitizeTeamNotes(row.team_notes),
      training_times: sanitizeTrainingTimes(row.training_times),
      season_breaks: sanitizeSeasonBreaks(row.season_breaks),
      responsibles: sanitizeResponsibles(row.responsibles),
      color: row.color || 'green',
      external_team_id:
        row.external_team_id != null ? sanitizeExternalTeamId(row.external_team_id) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

TeamModel.sanitizeTrainingTimes = sanitizeTrainingTimes;
TeamModel.sanitizePlayerCountHistory = sanitizePlayerCountHistory;
TeamModel.seedPlayerCountHistory = seedPlayerCountHistory;
TeamModel.appendPlayerCountHistory = appendPlayerCountHistory;

module.exports = TeamModel;
