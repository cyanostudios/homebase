// plugins/teams/model.js
// V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const TEAM_STATUSES = ['active', 'dormant', 'break'];
const TEAM_GENDERS = ['boys', 'girls', 'mixed'];
const TEAM_COLORS = ['green', 'blue', 'red', 'purple', 'orange', 'teal', 'white'];

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

function sanitizeTrainingTimes(value) {
  return parseJsonArray(value)
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      day: String(t.day ?? '').slice(0, 20),
      startTime: String(t.startTime ?? '').slice(0, 10),
      endTime: String(t.endTime ?? '').slice(0, 10),
      location: String(t.location ?? '').slice(0, 255),
    }))
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

class TeamModel {
  static getChangeSummary(existing, teamData) {
    const labels = {
      name: 'Name',
      age_group: 'Age group',
      gender: 'Gender',
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
      } = teamData;

      const trimmedName = decodeHtmlEntities((name || '').toString().trim());
      if (!trimmedName) {
        throw new AppError('Team name is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const sanitizedSeriesTeams =
        series_teams !== undefined ? sanitizeSeriesTeams(series_teams) : [];

      const result = await db.insert('teams', {
        name: trimmedName.slice(0, 255),
        age_group: decodeHtmlEntities((age_group || '').trim()) || null,
        gender: TEAM_GENDERS.includes(gender) ? gender : null,
        player_count: toIntOrDefault(player_count, 0),
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
      } = teamData;

      const trimmedName = decodeHtmlEntities((name || '').toString().trim());
      if (!trimmedName) {
        throw new AppError('Team name is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const sanitizedSeriesTeams =
        series_teams !== undefined ? sanitizeSeriesTeams(series_teams) : null;

      const changeSummary = TeamModel.getChangeSummary(current, teamData);

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
        player_count:
          player_count !== undefined
            ? toIntOrDefault(player_count, 0)
            : (current.player_count ?? 0),
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
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'teams', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete teams', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete teams', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      name: decodeHtmlEntities(row.name),
      age_group: row.age_group != null ? decodeHtmlEntities(row.age_group) : null,
      gender: row.gender ?? null,
      player_count: row.player_count != null ? Number(row.player_count) : 0,
      series_team_count: row.series_team_count != null ? Number(row.series_team_count) : 0,
      series_teams: sanitizeSeriesTeams(row.series_teams),
      status: row.status || 'active',
      status_note: row.status_note != null ? decodeHtmlEntities(row.status_note) : null,
      team_notes: sanitizeTeamNotes(row.team_notes),
      training_times: sanitizeTrainingTimes(row.training_times),
      season_breaks: sanitizeSeasonBreaks(row.season_breaks),
      responsibles: sanitizeResponsibles(row.responsibles),
      color: row.color || 'green',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = TeamModel;
