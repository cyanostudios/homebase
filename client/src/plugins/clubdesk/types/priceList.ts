import type { PublicationStatus } from './clubdesk';

export type { PublicationStatus };

export interface ClubdeskPriceListItem {
  id?: string;
  priceListId?: string;
  title: string;
  description: string | null;
  price: number;
  category: string | null;
  sequenceOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubdeskPriceListItemCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubdeskPriceList {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  featuredImageUrl: string | null;
  publicationStatus: PublicationStatus;
  currency: string;
  sortOrder?: number;
  itemCount?: number;
  items?: ClubdeskPriceListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ClubdeskPriceListItemPayload {
  title: string;
  description: string | null;
  price: number;
  category: string | null;
  sequenceOrder: number;
}

export interface ClubdeskPriceListPayload {
  title: string;
  slug?: string;
  description: string | null;
  featuredImageUrl: string | null;
  publicationStatus: PublicationStatus;
  currency: string;
  items: ClubdeskPriceListItemPayload[];
}
