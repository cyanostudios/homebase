// client/src/plugins/profixio/components/ProfixioList.tsx

import { Trophy, ArrowUp, ArrowDown } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContentToolbar } from '@/core/ui/ContentToolbar';

import { useProfixio } from '../hooks/useProfixio';
import { ProfixioMatch } from '../types/profixio';

type SortField = 'date' | 'homeTeam' | 'awayTeam' | 'result' | 'arena' | 'tournament';
type SortOrder = 'asc' | 'desc';

export const ProfixioList: React.FC = () => {
  const { matches, settings, loading, loadMatches } = useProfixio();
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>(settings?.defaultTeamFilter || 'IFK Malmö');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Load matches when settings or filters change
  // TEMPORARY: Load mock data even without API key/season/tournament for prototyping
  useEffect(() => {
    // For prototyping with mock data, always load matches
    loadMatches({
      seasonId: settings?.defaultSeasonId,
      tournamentId: settings?.defaultTournamentId,
      teamFilter: teamFilter || settings?.defaultTeamFilter || 'IFK Malmö',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultSeasonId, settings?.defaultTournamentId, teamFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedMatches = useMemo(() => {
    const filtered = matches.filter((match) => {
      const matchesSearch =
        match.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (match.matchCategory?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (match.field?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      let aValue: string | Date | null;
      let bValue: string | Date | null;

      if (sortField === 'date') {
        aValue = a.date ? new Date(a.date) : null;
        bValue = b.date ? new Date(b.date) : null;
      } else if (sortField === 'homeTeam') {
        aValue = a.homeTeam.name.toLowerCase();
        bValue = b.homeTeam.name.toLowerCase();
      } else if (sortField === 'awayTeam') {
        aValue = a.awayTeam.name.toLowerCase();
        bValue = b.awayTeam.name.toLowerCase();
      } else if (sortField === 'result') {
        const aResult =
          a.homeTeam.goals !== null && a.awayTeam.goals !== null
            ? `${a.homeTeam.goals}-${a.awayTeam.goals}`
            : '';
        const bResult =
          b.homeTeam.goals !== null && b.awayTeam.goals !== null
            ? `${b.homeTeam.goals}-${b.awayTeam.goals}`
            : '';
        aValue = aResult;
        bValue = bResult;
      } else if (sortField === 'arena') {
        aValue = (a.field?.name || '').toLowerCase();
        bValue = (b.field?.name || '').toLowerCase();
      } else {
        aValue = (a.matchCategory?.name || '').toLowerCase();
        bValue = (b.matchCategory?.name || '').toLowerCase();
      }

      if (sortField === 'date') {
        if (!aValue && !bValue) {
          return 0;
        }
        if (!aValue) {
          return sortOrder === 'asc' ? 1 : -1;
        }
        if (!bValue) {
          return sortOrder === 'asc' ? -1 : 1;
        }
        if (sortOrder === 'asc') {
          return (aValue as Date).getTime() - (bValue as Date).getTime();
        } else {
          return (bValue as Date).getTime() - (aValue as Date).getTime();
        }
      } else {
        if (sortOrder === 'asc') {
          return (aValue as string).localeCompare(bValue as string);
        } else {
          return (bValue as string).localeCompare(aValue as string);
        }
      }
    });
  }, [matches, searchTerm, sortField, sortOrder]);

  const formatResult = (match: ProfixioMatch) => {
    if (match.homeTeam.goals !== null && match.awayTeam.goals !== null) {
      return `${match.homeTeam.goals} - ${match.awayTeam.goals}`;
    }
    return '—';
  };

  const formatDate = (date: string | null) => {
    if (!date) {
      return '—';
    }
    return new Date(date).toLocaleDateString('sv-SE');
  };

  const formatTime = (time: string | null) => {
    if (!time) {
      return '—';
    }
    return time.substring(0, 5);
  };

  // Disabled: List items are not clickable for Profixio plugin
  // const handleOpenForView = (match: ProfixioMatch) => {
  //   attemptNavigation(() => {
  //     openMatchForView(match);
  //   });
  // };

  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search matches..."
      />

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="team-filter"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Filter by team:
          </label>
          <input
            id="team-filter"
            type="text"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            placeholder="IFK Malmö"
            className="px-3 py-1.5 text-sm border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>
      </div>

      <Card className="shadow-none">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">Loading matches...</div>
        ) : sortedMatches.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No matches found matching your search.'
              : settings?.apiKey
                ? 'No matches found. Please configure season or tournament in settings.'
                : 'Please configure your Profixio API key in settings.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    <span>Date</span>
                    {sortField === 'date' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('homeTeam')}
                >
                  <div className="flex items-center gap-2">
                    <span>Home Team</span>
                    {sortField === 'homeTeam' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('awayTeam')}
                >
                  <div className="flex items-center gap-2">
                    <span>Away Team</span>
                    {sortField === 'awayTeam' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('result')}
                >
                  <div className="flex items-center gap-2">
                    <span>Result</span>
                    {sortField === 'result' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('arena')}
                >
                  <div className="flex items-center gap-2">
                    <span>Arena</span>
                    {sortField === 'arena' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('tournament')}
                >
                  <div className="flex items-center gap-2">
                    <span>Tournament</span>
                    {sortField === 'tournament' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMatches.map((match) => (
                <TableRow key={`${match.tournamentId}-${match.id}`}>
                  <TableCell className="w-12">
                    <Trophy className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(match.date)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(match.time)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{match.homeTeam.name}</TableCell>
                  <TableCell className="font-medium">{match.awayTeam.name}</TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold">{formatResult(match)}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {match.field?.name || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {match.matchCategory?.name || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
