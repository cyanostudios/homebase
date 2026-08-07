export interface ClubdeskSwishProfile {
  id: string;
  payee: string;
  message: string;
  sortOrder: number;
  priceListIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export type ClubdeskSwishProfilePayload = {
  payee: string;
  message?: string;
  priceListIds?: string[] | number[];
};
