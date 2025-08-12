import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, Train, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Rail status badge colors
const RAIL_STATUS_COLORS = {
  on_time: 'bg-green-100 text-green-800 border-green-200',
  delayed: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  no_service: 'bg-gray-100 text-gray-700 border-gray-200',
} as const;

// Operator colors based on train number patterns
const OPERATOR_COLORS = {
  'SJ': 'bg-blue-100 text-blue-800 border-blue-200',
  'Öresundståg': 'bg-green-100 text-green-800 border-green-200', 
  'SL': 'bg-purple-100 text-purple-800 border-purple-200',
  'Västtrafik': 'bg-orange-100 text-orange-800 border-orange-200',
  'Skånetrafiken': 'bg-red-100 text-red-800 border-red-200',
  'Tågab': 'bg-gray-100 text-gray-700 border-gray-200',
  'Unknown': 'bg-gray-100 text-gray-600 border-gray-200',
} as const;

export const RailStationBoard: React.FC = () => {
  const { stations, loadingStations, codeToName, refreshStations } = useRails();
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState<string>('Cst');
  const [loading, setLoading] = useState(false);
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0); // Hours offset from current time
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Consistent time with offset used globally
  const currentTime = Date.now() + (timeOffset * 60 * 60 * 1000);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTrainOperator = (trainIdent?: string) => {
    if (!trainIdent) return 'Unknown';
    
    const num = parseInt(trainIdent);
    
    // SJ (Statens Järnvägar) - Long distance trains
    if ((num >= 400 && num <= 599) || (num >= 1400 && num <= 1599)) {
      return 'SJ';
    }
    
    // Öresundståg (cross-border Denmark-Sweden)
    if ((num >= 1000 && num <= 1099) || (num >= 1300 && num <= 1399)) {
      return 'Öresundståg';
    }
    
    // SL (Storstockholms Lokaltrafik) - Stockholm area
    if (num >= 40000 && num <= 49999) {
      return 'SL';
    }
    
    // Västtrafik - Gothenburg area
    if ((num >= 2000 && num <= 2999) || (num >= 3000 && num <= 3999)) {
      return 'Västtrafik';
    }
    
    // Skånetrafiken - Skåne region
    if ((num >= 1100 && num <= 1299) || (num >= 7000 && num <= 7999)) {
      return 'Skånetrafiken';
    }
    
    // Tågab and other regional
    if ((num >= 800 && num <= 999) || (num >= 8000 && num <= 8999)) {
      return 'Tågab';
    }
    
    return 'Unknown';
  };

  const getTimeUntil = (timeString?: string) => {
    if (!timeString) return null;
    
    const trainTime = new Date(timeString).getTime();
    const diffMinutes = Math.round((trainTime - Date.now()) / (1000 * 60)); // Use real time for relative display
    
    if (diffMinutes < -5) {
      const absDiff = Math.abs(diffMinutes);
      if (absDiff >= 60) {
        const hours = Math.floor(absDiff / 60);
        const mins = absDiff % 60;
        const timeText = mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
        return { text: timeText, className: 'text-gray-500' };
      }
      return { text: `${absDiff}m ago`, className: 'text-gray-500' };
    } else if (diffMinutes < 0) {
      return { text: 'Just left', className: 'text-orange-600' };
    } else if (diffMinutes === 0) {
      return { text: 'Now', className: 'text-red-600 font-medium' };
    } else if (diffMinutes === 1) {
      return { text: '1m', className: 'text-red-600 font-medium' };
    } else if (diffMinutes <= 5) {
      return { text: `${diffMinutes}m`, className: 'text-orange-600 font-medium' };
    } else if (diffMinutes <= 15) {
      return { text: `${diffMinutes}m`, className: 'text-yellow-600' };
    } else if (diffMinutes >= 60) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      const timeText = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      return { text: timeText, className: 'text-gray-600' };
    } else {
      return null; // Don't show for trains far in future (16-59 minutes)
    }
  };

  const getTrainStatus = (announcement: Announcement) => {
    // Check if train is cancelled
    if (
      announcement.Deviation?.some(
        (d) =>
          d.Code === 'CANCELLED' ||
          d.Description?.toLowerCase().includes('cancel') ||
          d.Description?.toLowerCase().includes('inställd')
      )
    ) {
      return { status: 'cancelled', text: 'Cancelled' };
    }

    // Check for service disruptions
    if (
      announcement.Deviation?.some(
        (d) =>
          d.Description?.toLowerCase().includes('no service') ||
          d.Description?.toLowerCase().includes('trafik inställd')
      )
    ) {
      return { status: 'no_service', text: 'No Service' };
    }

    // Check for track changes and other deviations
    if (announcement.Deviation && announcement.Deviation.length > 0) {
      const deviation = announcement.Deviation[0];
      if (
        deviation.Description?.toLowerCase().includes('spärändrat') ||
        deviation.Description?.toLowerCase().includes('spårändrat')
      ) {
        return { status: 'delayed', text: 'Track Change' };
      }
    }

    // Check for delays (compare Estimated vs Advertised)
    if (announcement.EstimatedTimeAtLocation && announcement.AdvertisedTimeAtLocation) {
      const advertised = new Date(announcement.AdvertisedTimeAtLocation).getTime();
      const estimated = new Date(announcement.EstimatedTimeAtLocation).getTime();
      const delayMinutes = Math.round((estimated - advertised) / (1000 * 60));

      if (delayMinutes > 2) {
        return { status: 'delayed', text: `+${delayMinutes}m` };
      } else if (delayMinutes < -2) {
        return { status: 'on_time', text: `${delayMinutes}m early` };
      }
    }

    // Default to on time
    return { status: 'on_time', text: 'On Time' };
  };

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
    try {      const res = await railApi.getAnnouncements(station);
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
    if (selectedCode) {
      load(selectedCode);
    }
  }, [selectedCode]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000));
    if (seconds < 60) return `${seconds}s sedan`;
    const m = Math.floor(seconds / 60);
    return `${m}m sedan`;
  }, [lastUpdated]);

  const sorted = [...(ann ?? [])].sort((x, y) => {
    const tx = nextTime(x.AdvertisedTimeAtLocation, x.EstimatedTimeAtLocation);
    const ty = nextTime(y.AdvertisedTimeAtLocation, y.EstimatedTimeAtLocation);
    return tx - ty;
  });

  // Fallback window when no upcoming items
const LOOKBACK_MS = 60 * 60 * 1000; // 1h fallback

  // Picks up to 8 trains with tiered strategy: upcoming -> recent (lookback) -> nearest by absolute time
const pickTrains = (trains: Announcement[]) => {
  const toMs = (t: Announcement) => nextTime(t.AdvertisedTimeAtLocation, t.EstimatedTimeAtLocation);

  // 1) Upcoming
  const upcoming = trains.filter((t) => toMs(t) >= currentTime);
  if (upcoming.length > 0) return { list: upcoming.slice(0, 8), mode: 'upcoming' as const };

  // 2) Recent within lookback window
  const windowStart = currentTime - LOOKBACK_MS;
  const recent = trains.filter((t) => {
    const tt = toMs(t);
    return tt >= windowStart && tt < currentTime;
  });
  if (recent.length > 0) return { list: recent.slice(-8), mode: 'recent' as const };

  // 3) Nearest by absolute distance to now (ensures we always show something meaningful)
  const nearest = [...trains]
    .sort((a, b) => Math.abs(toMs(a) - currentTime) - Math.abs(toMs(b) - currentTime))
    .slice(0, 8);
  return { list: nearest, mode: 'nearest' as const };
};
  
  

  const depPick = pickTrains(sorted.filter(a => a.ActivityType === 'Avgang'));
  const arrPick = pickTrains(sorted.filter(a => a.ActivityType === 'Ankomst'));
  const departures = depPick.list;
  const arrivals = arrPick.list;

  const filteredStations = stations.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.code.toLowerCase().includes(query.toLowerCase())
  );

  const getTimeLabel = () => {
    if (timeOffset === 0) return 'Nu';
    if (timeOffset > 0) return `+${timeOffset}h`;
    return `${timeOffset}h`;
  };

  const handleTimeNavigation = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setTimeOffset(prev => prev - 1);
    } else {
      setTimeOffset(prev => prev + 1);
    }
  };

  const resetToNow = () => {
    setTimeOffset(0);
  };

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Rail – Station Board</Heading>
          <Text variant="caption">Realtid: avgångar/ankomster</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Sök station..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
                          setQuery(s.name + ' (' + s.code + ')');
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
          <Button variant="secondary" icon={RefreshCw} onClick={() => load(selectedCode)} disabled={loading}>
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Station info */}
      <Card padding="sm" className="mb-6">
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
        </Card>

      {/* Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Navigation */}
        <div className="lg:col-span-2 flex items-center justify-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            onClick={() => handleTimeNavigation('prev')}
            title="Visa tidigare tåg"
          >
            Tidigare
          </Button>
          
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {timeOffset === 0 ? 'Nu' : `${getTimeLabel()} från nu`}
            </span>
            {timeOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToNow}
                className="text-xs"
              >
                Tillbaka till nu
              </Button>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronRight}
            onClick={() => handleTimeNavigation('next')}
            title="Visa senare tåg"
          >
            Senare
          </Button>
        </div>

        {/* Departures */}
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">
              Avgångar (nästa 8 kommande) - {departures.length} st {depPick.mode !== 'upcoming' && (
              <span className="ml-2 text-xs italic text-gray-500">(visar {depPick.mode === 'recent' ? 'senaste inom ' + (LOOKBACK_MS/3600000) + 'h' : 'närmast i tid'})</span>
            )}
            </h3>
          </div>
          <div className="bg-gray-50 px-4 py-2 border-b">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-16">Tid</div>
                <div className="flex-1">Destination</div>
              </div>
              <div className="flex items-center gap-3">
                <div>Tåg</div>
                <div>Spår</div>
              </div>
            </div>
          </div>
          <div className="divide-y">
            {departures.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                Inga kommande avgångar tillgängliga för denna station.
              </div>
            ) : (
              departures.map((a, i) => {
                const time = a.EstimatedTimeAtLocation ?? a.AdvertisedTimeAtLocation;
                const dest = a.ToLocation?.[0]?.LocationName;
                const trainStatus = getTrainStatus(a);
                const timeUntil = getTimeUntil(time);
                const operator = getTrainOperator(a.AdvertisedTrainIdent);
                const hasDeviation = a.Deviation && a.Deviation.length > 0;
                
                return (
                  <div key={i} className="p-4">
                    {/* First row */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-sm font-medium tabular-nums w-16">{fmtTime(time)}</div>
                        <div className="text-sm text-gray-600 truncate flex-1 font-medium">
                          {dest ? codeToName(dest) : '—'}
                          {hasDeviation && (
                            <div className="text-xs text-orange-600 mt-0.5 font-normal" title={a.Deviation?.[0]?.Description}>
                              {a.Deviation?.[0]?.Description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-700">{a.AdvertisedTrainIdent ?? '—'}</div>
                        <div className="text-sm text-gray-600">Spår {a.TrackAtLocation ?? '—'}</div>
                      </div>
                    </div>
                    
                    {/* Second row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-16">
                          {timeUntil && (
                            <div className={`text-xs ${timeUntil.className}`}>{timeUntil.text}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              OPERATOR_COLORS[operator]
                            }`}
                          >
                            {operator}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              RAIL_STATUS_COLORS[trainStatus.status]
                            }`}
                          >
                            {trainStatus.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Arrivals */}
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">
              Ankomster (nästa 8 kommande) - {arrivals.length} st
            </h3>
          </div>
          <div className="bg-gray-50 px-4 py-2 border-b">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-16">Tid</div>
                <div className="flex-1">Från</div>
              </div>
              <div className="flex items-center gap-3">
                <div>Tåg</div>
                <div>Spår</div>
              </div>
            </div>
          </div>
          <div className="divide-y">
            {arrivals.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Inga kommande ankomster</div>
            ) : (
              arrivals.map((a, i) => {
                const time = a.EstimatedTimeAtLocation ?? a.AdvertisedTimeAtLocation;
                const from = a.FromLocation?.[0]?.LocationName;
                const trainStatus = getTrainStatus(a);
                const timeUntil = getTimeUntil(time);
                const operator = getTrainOperator(a.AdvertisedTrainIdent);
                const hasDeviation = a.Deviation && a.Deviation.length > 0;
                
                return (
                  <div key={i} className="p-4">
                    {/* First row */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-sm font-medium tabular-nums w-16">{fmtTime(time)}</div>
                        <div className="text-sm text-gray-600 truncate flex-1 font-medium">
                          {from ? codeToName(from) : '—'}
                          {hasDeviation && (
                            <div className="text-xs text-orange-600 mt-0.5 font-normal" title={a.Deviation?.[0]?.Description}>
                              {a.Deviation?.[0]?.Description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-700">{a.AdvertisedTrainIdent ?? '—'}</div>
                        <div className="text-sm text-gray-600">Spår {a.TrackAtLocation ?? '—'}</div>
                      </div>
                    </div>
                    
                    {/* Second row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-16">
                          {timeUntil && (
                            <div className={`text-xs ${timeUntil.className}`}>{timeUntil.text}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              OPERATOR_COLORS[operator]
                            }`}
                          >
                            {operator}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              RAIL_STATUS_COLORS[trainStatus.status]
                            }`}
                          >
                            {trainStatus.text}
                          </span>
                        </div>
                      </div>
                    </div>
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
