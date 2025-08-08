// client/src/plugins/rail/components/RailStationBoard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, Train, Clock } from 'lucide-react';
import { railApi } from '../api/railApi';
import { useRails } from '../hooks/useRails';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';

function parseTime(a?: string) {
  return a ? new Date(a).getTime() : 0;
}

function nextTime(a?: string, e?: string) {
  return e ? parseTime(e) : parseTime(a);
}

type Announcement = {
  ActivityType: 'Avgang' | 'Ankomst';
  AdvertisedTimeAtLocation?: string;
  EstimatedTimeAtLocation?: string;
  AdvertisedTrainIdent?: string;
  FromLocation?: Array<{ LocationName: string }>;
  ToLocation?: Array<{ LocationName: string }>;
  TrackAtLocation?: string;
  Deviation?: Array<{ Code?: string; Description?: string }>;
};

export const RailStationBoard: React.FC = () => {
  const { stations, loadingStations, codeToName, refreshStations } = useRails();

  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState<string>('Cst');
  const [loading, setLoading] = useState(false);
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fmtTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const load = async (station: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await railApi.getAnnouncements(station);
      const data = (res.announcements || []) as Announcement[];
      data.sort((a, b) => {
        const atA = new Date(a.EstimatedTimeAtLocation || a.AdvertisedTimeAtLocation || 0).getTime();
        const atB = new Date(b.EstimatedTimeAtLocation || b.AdvertisedTimeAtLocation || 0).getTime();
        return atA - atB;
      });
      setAnn(data);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCode) load(selectedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000));
    if (seconds < 60) return `${seconds}s sedan`;
    const m = Math.floor(seconds / 60);
    return `${m}m sedan`;
  }, [lastUpdated]);

  const now = Date.now();
  const sorted = [...(ann ?? [])].sort((x, y) => {
    const tx = nextTime(x.AdvertisedTimeAtLocation, x.EstimatedTimeAtLocation);
    const ty = nextTime(y.AdvertisedTimeAtLocation, y.EstimatedTimeAtLocation);
    return tx - ty;
  });

  const future = sorted.filter(a => nextTime(a.AdvertisedTimeAtLocation, a.EstimatedTimeAtLocation) >= now);
  const departures = future.filter(a => a.ActivityType === 'Avgang').slice(0, 20);
  const arrivals = future.filter(a => a.ActivityType === 'Ankomst').slice(0, 20);

  const filteredStations = stations.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Rail – Station Board</Heading>
          <Text variant="caption">Realtid: avgångar/ankomster</Text>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => load(selectedCode)}
            disabled={loading}
          >
            Uppdatera
          </Button>
          <Button
            variant="ghost"
            icon={RefreshCw}
            onClick={() => refreshStations()}
            disabled={loadingStations}
            title="Uppdatera stationsindex"
          >
            Uppd. stationer
          </Button>
        </div>
      </div>

      {/* Station picker */}
      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div className="md:col-span-1 relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Sök namn eller kod (t.ex. Cst)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {dropdownOpen && (
              <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow">
                {filteredStations.length === 0 ? (
                  <li className="p-3 text-sm text-gray-500">Inga träffar</li>
                ) : (
                  filteredStations.slice(0, 200).map((s) => (
                    <li key={s.code}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCode(s.code);
                          setQuery(s.name + " (" + s.code + ")");
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          selectedCode === s.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{s.code}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* Station meta */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <Train className="w-5 h-5 text-gray-500" />
              <div className="text-sm">
                <div className="text-gray-900 font-medium">
                  {codeToName(selectedCode)}{' '}
                  <span className="text-gray-500 font-normal">({selectedCode})</span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {lastUpdated ? `Uppdaterad ${lastUpdatedLabel}` : '—'}
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Avgångar */}
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Avgångar (nästa 10)</h3>
          </div>
          <div className="divide-y">
            {departures.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Inga kommande avgångar</div>
            ) : (
              departures.map((a, i) => {
                const time = a.EstimatedTimeAtLocation ?? a.AdvertisedTimeAtLocation;
                const dest = a.ToLocation?.[0]?.LocationName;
                return (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium tabular-nums">{fmtTime(time)}</div>
                      <div className="text-sm text-gray-700">{a.AdvertisedTrainIdent ?? '—'}</div>
                      <div className="text-sm text-gray-600">{dest ? codeToName(dest) : '—'}</div>
                    </div>
                    <div className="text-sm text-gray-600">{a.TrackAtLocation ?? '—'}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ankomster */}
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Ankomster (nästa 10)</h3>
          </div>
          <div className="divide-y">
            {arrivals.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Inga kommande ankomster</div>
            ) : (
              arrivals.map((a, i) => {
                const time = a.EstimatedTimeAtLocation ?? a.AdvertisedTimeAtLocation;
                const from = a.FromLocation?.[0]?.LocationName;
                return (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium tabular-nums">{fmtTime(time)}</div>
                      <div className="text-sm text-gray-700">{a.AdvertisedTrainIdent ?? '—'}</div>
                      <div className="text-sm text-gray-600">{from ? codeToName(from) : '—'}</div>
                    </div>
                    <div className="text-sm text-gray-600">{a.TrackAtLocation ?? '—'}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
