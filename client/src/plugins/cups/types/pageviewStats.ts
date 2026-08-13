export type CupPageviewSourceRow = {
  bucket: string;
  referrer_domain: string;
  views: number;
};

export type CupPageviewTopCup = {
  cup_id: number;
  name: string;
  district: string | null;
  start_date: string | null;
  end_date: string | null;
  views: number;
};

export type CupPageviewTopDistrict = {
  district_slug: string;
  views: number;
};

export type CupPageviewSeriesPoint = {
  day: string;
  views: number;
};

export type CupPageviewTotals = {
  views: number;
  cups: number;
  districts: number;
  sources: number;
};

export type CupPageviewStats = {
  days: number;
  totals: CupPageviewTotals;
  series: CupPageviewSeriesPoint[];
  topCups: CupPageviewTopCup[];
  topDistricts: CupPageviewTopDistrict[];
  sources: CupPageviewSourceRow[];
};
