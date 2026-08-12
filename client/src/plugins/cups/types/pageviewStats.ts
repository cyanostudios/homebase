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

export type CupPageviewStats = {
  days: number;
  totals: { views: number };
  topCups: CupPageviewTopCup[];
  topDistricts: CupPageviewTopDistrict[];
  sources: CupPageviewSourceRow[];
};
