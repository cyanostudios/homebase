import { useEffect, useMemo } from 'react';

import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { Team } from '@/plugins/teams/types/teams';

/** Teams available for linking on requests — loaded from the Teams plugin context. */
export function useRequestTeams(): Team[] {
  const { teams, refreshTeams } = useTeams();

  useEffect(() => {
    if (teams.length === 0) {
      void refreshTeams();
    }
  }, [teams.length, refreshTeams]);

  return useMemo(
    () =>
      [...teams].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [teams],
  );
}
