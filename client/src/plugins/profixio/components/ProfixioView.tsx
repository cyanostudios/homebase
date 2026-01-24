// client/src/plugins/profixio/components/ProfixioView.tsx

import { Trophy, Calendar, Clock, MapPin, ExternalLink } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';

import { ProfixioMatch } from '../types/profixio';

interface ProfixioViewProps {
  match: ProfixioMatch;
}

export const ProfixioView: React.FC<ProfixioViewProps> = ({ match }) => {
  if (!match) {
    return null;
  }

  const formatDate = (date: string | null) => {
    if (!date) {
      return '—';
    }
    return new Date(date).toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) {
      return '—';
    }
    return time.substring(0, 5);
  };

  const formatResult = () => {
    if (match.homeTeam.goals !== null && match.awayTeam.goals !== null) {
      return `${match.homeTeam.goals} - ${match.awayTeam.goals}`;
    }
    return 'Not played yet';
  };

  const getWinnerBadge = () => {
    if (match.hasWinner) {
      if (match.homeTeam.isWinner) {
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
            Winner
          </Badge>
        );
      } else if (match.awayTeam.isWinner) {
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
            Winner
          </Badge>
        );
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Match Info */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Match Information">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {match.homeTeam.name} vs {match.awayTeam.name}
              </span>
              {getWinnerBadge()}
            </div>

            {match.date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Date:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(match.date)}
                </span>
              </div>
            )}

            {match.time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Time:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {formatTime(match.time)}
                </span>
              </div>
            )}

            {match.field && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Arena:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {match.field.name}
                  {match.field.arena && ` (${match.field.arena.arenaName})`}
                </span>
              </div>
            )}
          </div>
        </DetailSection>
      </Card>

      {/* Result */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Result">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Home Team</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {match.homeTeam.name}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatResult()}
            </div>
            <div className="flex-1 text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Away Team</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {match.awayTeam.name}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>

      {/* Sets (if available) */}
      {match.sets && match.sets.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title="Sets">
            <div className="space-y-2">
              {match.sets.map((set) => {
                const setKey = `${match.id}-${set.home}-${set.away}`;
                return (
                  <div key={setKey} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Set {match.sets.indexOf(set) + 1}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {set.home} - {set.away}
                    </span>
                  </div>
                );
              })}
            </div>
          </DetailSection>
        </Card>
      )}

      {/* Tournament Info */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Tournament Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {match.matchCategory && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Category</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {match.matchCategory.name}
                </div>
              </div>
            )}
            {match.matchGroup && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Group</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {match.matchGroup.displayName}
                </div>
              </div>
            )}
            {match.gameRound && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Round</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">{match.gameRound}</div>
              </div>
            )}
            {match.number && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Match Number</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">{match.number}</div>
              </div>
            )}
          </div>
        </DetailSection>
      </Card>

      {/* Match URL */}
      {match.matchUrl && (
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title="External Link">
            <a
              href={match.matchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              <ExternalLink className="w-4 h-4" />
              View match on Profixio
            </a>
          </DetailSection>
        </Card>
      )}

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Match Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Match ID</div>
              <div className="text-sm font-mono text-gray-900 dark:text-gray-100">{match.id}</div>
            </div>
            {match.tournamentId && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Tournament ID</div>
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {match.tournamentId}
                </div>
              </div>
            )}
            {match.matchDataUpdated && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Last Updated</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(match.matchDataUpdated).toLocaleString('sv-SE')}
                </div>
              </div>
            )}
            {match.periodInfo && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Period Info</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {match.periodInfo.numberOfPeriods} period(s), {match.periodInfo.periodLength} min
                  each
                </div>
              </div>
            )}
          </div>
        </DetailSection>
      </Card>
    </div>
  );
};
