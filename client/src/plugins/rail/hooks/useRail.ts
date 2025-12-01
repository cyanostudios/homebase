// client/src/plugins/rail/hooks/useRail.ts
import { useRailContext } from '../context/RailContext';

export function useRail() {
  return useRailContext();
}