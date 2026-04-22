/* eslint-disable eqeqeq */
// Dedicated API client for Products (with 409-aware error handling and CSRF)

import { getSharedCsrfToken } from '@/core/api/csrf';

import type { ProductCatalogSearchScope } from '../constants/productCatalogSearchScopes';
import type { Product, ProductImageAsset } from '../types/products';

export type ProductListSortField = 'id' | 'title' | 'quantity' | 'priceAmount' | 'sku';

export type ProductListParams = {
  limit: number;
  offset: number;
  sort: ProductListSortField;
  order: 'asc' | 'desc';
  q?: string;
  /** Catalog search scope; default all on server. */
  searchIn?: ProductCatalogSearchScope;
  /** all | main | list id */
  list: string;
};

export type ApiFieldError = { field: string; message: string };
export type ProductImportMode = 'update-only' | 'create-only' | 'upsert';
export type ProductImportMatchKey = 'sku' | 'id' | 'gtin' | 'ean';

export type ProductImportJobSnapshot = {
  id: string;
  status: string;
  mode: ProductImportMode;
  matchKey: string;
  originalFilename: string;
  mimeType: string | null;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  skippedMissingKey: number;
  skippedInvalid: number;
  conflictsCount: number;
  notFoundCount: number;
  detectedHeaders: string[];
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type ProductImportStartResponse = {
  ok: true;
  accepted: true;
  jobId: string;
  mode: ProductImportMode;
  matchKey: string;
  totalRows: number;
};

export type ImportColumnRef = { name: string; description: string };
export type ImportColumnReferenceResponse = {
  general: ImportColumnRef[];
  sello: ImportColumnRef[];
  channels: Array<{
    channel: string;
    instanceKey: string;
    numericId: string;
    market: string | null;
    label: string | null;
    exampleColumns: string[];
    legacyHints: string[];
  }>;
};

export type ExportColumnDef = {
  id: string;
  label: string;
  description: string;
  group: string;
};

export type ExportColumnReferenceResponse = {
  general: ExportColumnDef[];
  instances: Array<{
    id: string;
    channel: string;
    instanceKey: string;
    market: string | null;
    label: string | null;
    enabled: boolean;
  }>;
  channelColumns: Array<{
    instanceId: string;
    channel: string;
    instanceKey: string;
    market: string | null;
    label: string | null;
    enabled: boolean;
    fields: Array<{ headerKey: string; field: string; label: string }>;
  }>;
};

export type ProductExportRequestBody = {
  columnIds: string[];
  list: string;
  filterChannelInstanceIds: number[];
  columnChannelInstanceIds: number[];
};

/** Finished import job (after background processing). */
export type ProductImportResult = { ok: true; job: ProductImportJobSnapshot };

export type ProductDuplicateIncompleteGroup = {
  groupId: string;
  memberIds: string[];
};

export type ProductDuplicateJobSnapshot = {
  id: string;
  status: string;
  /** products | media | done */
  phase: string;
  totalProducts: number;
  processedProducts: number;
  createdCount: number;
  errorCount: number;
  lastError: string | null;
  productsCompletedAt: string | null;
  mediaTotal: number;
  mediaProcessed: number;
  mediaErrorCount: number;
  payload: { productIds?: string[]; copyMedia?: boolean };
  result: {
    createdIds?: Array<{ sourceId: string; newId: string }>;
    errors?: Array<{ sourceId: string; error: string }>;
  };
  createdAt: string;
  completedAt: string | null;
};

export type SelloSettings = {
  id?: string;
  apiKey: string;
  connected: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

class ProductsApi {
  private listsCache: {
    items: Array<{
      id: string;
      name: string;
      namespace: string;
      createdAt: string;
      updatedAt: string;
    }>;
    fetchedAt: number;
  } | null = null;
  private listsPromise: Promise<
    Array<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }>
  > | null = null;

  private async getCsrfToken(): Promise<string> {
    return getSharedCsrfToken();
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };

      // Add CSRF token for mutations
      if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = await this.getCsrfToken();
      }

      response = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    if (!response.ok) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch (_err) {
        void _err;
      }

      // Handle 404 specifically
      if (response.status === 404) {
        const err: any = new Error(payload?.error || payload?.message || 'Product not found');
        err.status = 404;
        err.error = payload?.error || 'Product not found';
        if (payload?.errors) {
          err.errors = payload.errors;
        }
        throw err;
      }

      // Handle 409 conflicts with field errors
      if (response.status === 409 && payload?.errors) {
        const err: any = new Error(
          payload.errors[0]?.message || 'A product with this information already exists',
        );
        err.status = 409;
        err.errors = payload.errors;
        if (payload?.code) {
          err.code = payload.code;
        }
        throw err;
      }

      // Generic error handling
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Request failed',
      );
      err.status = response.status;
      err.error = payload?.error || payload?.message;
      if (payload?.code) {
        err.code = payload.code;
      }
      if (payload?.errors) {
        err.errors = payload.errors;
      }
      throw err;
    }

    // Vissa DELETE-endpoints returnerar tom body
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // ---- Lookups ----

  async getBrands(): Promise<{ id: string; name: string }[]> {
    const res = await this.request('/products/brands');
    return res.items ?? [];
  }

  async createBrand(name: string): Promise<{ id: string; name: string }> {
    return this.request('/products/brands', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getSuppliers(): Promise<{ id: string; name: string }[]> {
    const res = await this.request('/products/suppliers');
    return res.items ?? [];
  }

  async createSupplier(name: string): Promise<{ id: string; name: string }> {
    return this.request('/products/suppliers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getManufacturers(): Promise<{ id: string; name: string }[]> {
    const res = await this.request('/products/manufacturers');
    return res.items ?? [];
  }

  async createManufacturer(name: string): Promise<{ id: string; name: string }> {
    return this.request('/products/manufacturers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // ---- Lists ----

  async getLists(): Promise<
    Array<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }>
  > {
    const now = Date.now();
    if (this.listsCache && now - this.listsCache.fetchedAt < 30_000) {
      return this.listsCache.items;
    }
    if (this.listsPromise) {
      return this.listsPromise;
    }
    this.listsPromise = this.request('/products/lists')
      .then((items) => {
        const normalized = Array.isArray(items) ? items : [];
        this.listsCache = { items: normalized, fetchedAt: Date.now() };
        return normalized;
      })
      .finally(() => {
        this.listsPromise = null;
      });
    return this.listsPromise;
  }

  async setProductList(productId: string, listId: string | null): Promise<Product> {
    return this.request(`/products/${encodeURIComponent(productId)}/list`, {
      method: 'PUT',
      body: JSON.stringify({ listId }),
    });
  }

  /** PUT /api/products/batch/list — move many products to Huvudlista (listId null) or a named list. */
  async batchSetProductList(
    ids: string[],
    listId: string | null,
  ): Promise<{ ok: true; updatedCount: number }> {
    return this.request('/products/batch/list', {
      method: 'PUT',
      body: JSON.stringify({ ids, listId }),
    });
  }

  /** POST /api/products/duplicate/precheck — variant groups where not all members are selected. */
  async duplicatePrecheck(
    ids: string[],
  ): Promise<{ incompleteGroups: ProductDuplicateIncompleteGroup[] }> {
    return this.request('/products/duplicate/precheck', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * POST /api/products/duplicate/jobs — 202, background duplicate with optional media copy.
   */
  async startDuplicateJob(
    productIds: string[],
    copyMedia: boolean,
  ): Promise<{
    ok: true;
    jobId: string;
    accepted: boolean;
    totalProducts: number;
    copyMedia: boolean;
  }> {
    return this.request('/products/duplicate/jobs', {
      method: 'POST',
      body: JSON.stringify({ productIds, copyMedia }),
    });
  }

  async getDuplicateJob(jobId: string): Promise<{ job: ProductDuplicateJobSnapshot }> {
    return this.request(`/products/duplicate/jobs/${encodeURIComponent(jobId)}`);
  }

  async waitForDuplicateJob(jobId: string, intervalMs = 750): Promise<ProductDuplicateJobSnapshot> {
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      const { job } = await this.getDuplicateJob(jobId);
      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }
      await this.sleep(intervalMs);
    }
    const err: any = new Error('Produktkopiering tog för lång tid');
    err.code = 'DUPLICATE_TIMEOUT';
    throw err;
  }

  // ---- CRUD ----

  /** Paginated catalog list; GET /api/products returns { items, total }. */
  async listProducts(params: ProductListParams): Promise<{ items: Product[]; total: number }> {
    const qs = new URLSearchParams();
    qs.set('limit', String(params.limit));
    qs.set('offset', String(params.offset));
    qs.set('sort', params.sort);
    qs.set('order', params.order);
    if (params.q != null && String(params.q).trim() !== '') {
      qs.set('q', String(params.q).trim());
    }
    const searchIn = params.searchIn != null ? String(params.searchIn).trim() : 'all';
    if (searchIn !== '') {
      qs.set('searchIn', searchIn);
    }
    qs.set('list', params.list);
    return this.request(`/products?${qs.toString()}`) as Promise<{
      items: Product[];
      total: number;
    }>;
  }

  /** Tenant-scoped product row count; does not load full catalog. */
  async getProductCount(): Promise<number> {
    const res = await this.request('/products/count');
    const n = Number((res as { count?: number })?.count);
    return Number.isFinite(n) ? n : 0;
  }

  async uploadMediaFiles(files: File[], productId?: string | null): Promise<ProductImageAsset[]> {
    const fd = new FormData();
    for (const file of files) {
      fd.append('files', file, file.name);
    }
    if (productId != null && String(productId).trim() !== '') {
      fd.append('productId', String(productId).trim());
    }
    const csrfToken = await this.getCsrfToken();
    const response = await fetch('/api/products/media/upload', {
      method: 'POST',
      body: fd,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : null;
    if (!response.ok) {
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Upload failed',
      );
      err.status = response.status;
      err.code = payload?.code;
      throw err;
    }
    return Array.isArray(payload) ? payload : [];
  }

  async createDraftProduct(): Promise<Product> {
    return this.request('/products/draft', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async createProduct(data: any): Promise<Product> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any): Promise<Product> {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getProductStats(
    productId: string,
    range?: '7d' | '30d' | '3m' | 'all',
    timelineOpts?: { timelineLimit?: number; timelineOffset?: number },
  ): Promise<{
    soldCount: number;
    bestChannel: string | null;
    activeTargetsCount: number;
    timeline: Array<
      | {
          type: 'sale';
          channel: string;
          orderId: string;
          quantity: number;
          placedAt: string | null;
        }
      | {
          type: 'quantity_change';
          previousQuantity: number | null;
          newQuantity: number;
          source: string;
          placedAt: string | null;
        }
    >;
    timelineHasMore: boolean;
  }> {
    const q = new URLSearchParams();
    if (range) {
      q.set('range', range);
    }
    if (timelineOpts?.timelineLimit != null) {
      q.set('timelineLimit', String(timelineOpts.timelineLimit));
    }
    if (timelineOpts?.timelineOffset != null) {
      q.set('timelineOffset', String(timelineOpts.timelineOffset));
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/products/${encodeURIComponent(productId)}/stats${suffix}`);
  }

  async deleteProduct(id: string): Promise<void> {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ---- Group products (variant group) ----
  // POST /api/products/group
  // body: { productIds: string[], groupVariationType: 'color'|'size'|'model', mainProductId?: string }
  async groupProducts(
    productIds: string[],
    groupVariationType: 'color' | 'size' | 'model',
    mainProductId?: string | null,
  ): Promise<{
    ok: true;
    updatedCount: number;
    mainProductId: number;
    groupVariationType: string;
  }> {
    const body: { productIds: string[]; groupVariationType: string; mainProductId?: string } = {
      productIds,
      groupVariationType,
    };
    if (mainProductId != null && String(mainProductId).trim()) {
      body.mainProductId = String(mainProductId).trim();
    }
    return this.request('/products/group', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ---- Batch sync job (202 + jobId) ----
  // PATCH /api/products/batch — body { ids, updates } eller { ids, changes }
  async batchUpdate(
    ids: string[],
    updates: Record<string, unknown>,
  ): Promise<{
    ok: true;
    jobId: string | null;
    accepted?: boolean;
    totalProducts?: number;
    message?: string;
  }> {
    return this.request('/products/batch', {
      method: 'PATCH',
      body: JSON.stringify({ ids, updates }),
    });
  }

  async listBatchSyncJobs(): Promise<{
    jobs: Array<{
      id: string;
      status: string;
      totalProducts: number;
      processedDb: number;
      processedChannels: number;
      productIds: string[];
      changes: Record<string, unknown>;
      errors: unknown[];
      createdByUserId: string | null;
      triggerSource: string;
      createdAt: string;
      completedAt: string | null;
    }>;
  }> {
    return this.request('/products/batch/sync-jobs');
  }

  async getBatchSyncJob(jobId: string): Promise<{ job: any }> {
    return this.request(`/products/batch/sync-jobs/${encodeURIComponent(jobId)}`);
  }

  // ---- Bulk delete (Platform) ----
  // DELETE /api/products/batch
  // body: { ids: string[] }
  async deleteProductsBulk(
    ids: string[],
  ): Promise<{ ok: true; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/products/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  // ---- Import (async job, HTTP 202) ----
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getImportJob(jobId: string): Promise<{ job: ProductImportJobSnapshot }> {
    return this.request(`/products/import/jobs/${encodeURIComponent(jobId)}`);
  }

  async getImportHistory(): Promise<{ items: ProductImportJobSnapshot[] }> {
    return this.request('/products/import/history');
  }

  async getImportColumnReference(): Promise<ImportColumnReferenceResponse> {
    return this.request('/products/import/column-reference');
  }

  async getExportColumnReference(): Promise<ExportColumnReferenceResponse> {
    return this.request('/products/export/column-reference');
  }

  /**
   * POST /api/products/export — returns Excel blob; throws with .status and JSON body on error.
   */
  async exportProductsToExcel(body: ProductExportRequestBody): Promise<Blob> {
    const csrf = await this.getCsrfToken();
    const response = await fetch('/api/products/export', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let payload: { error?: string; message?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        void 0;
      }
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Export failed',
      );
      err.status = response.status;
      err.error = payload?.error;
      throw err;
    }
    return response.blob();
  }

  async downloadImportFile(jobId: string): Promise<Blob> {
    const response = await fetch(`/api/products/import/history/${encodeURIComponent(jobId)}/file`, {
      credentials: 'include',
    });
    if (!response.ok) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        void 0;
      }
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Download failed',
      );
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }

  /**
   * POST /api/products/import — 202 with jobId; worker processes file in background.
   */
  async startProductImport(
    file: File,
    mode: ProductImportMode,
    matchKey: ProductImportMatchKey = 'sku',
  ): Promise<ProductImportStartResponse> {
    const csrf = await this.getCsrfToken();
    const form = new FormData();
    form.append('mode', mode);
    form.append('matchKey', matchKey);
    form.append('file', file);

    const response = await fetch('/api/products/import', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': csrf,
      },
      body: form,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Import failed',
      );
      err.status = response.status;
      err.error = payload?.error || payload?.message;
      if (payload?.errors) {
        err.errors = payload.errors;
      }
      throw err;
    }

    if (response.status !== 202 || !payload?.jobId) {
      const err: any = new Error('Unexpected import response');
      err.status = response.status;
      throw err;
    }

    return {
      ok: true,
      accepted: true,
      jobId: String(payload.jobId),
      mode: payload.mode as ProductImportMode,
      matchKey: String(payload.matchKey || matchKey),
      totalRows: Number(payload.totalRows) || 0,
    };
  }

  async waitForImportJob(jobId: string, intervalMs = 750): Promise<ProductImportJobSnapshot> {
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      const { job } = await this.getImportJob(jobId);
      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }
      await this.sleep(intervalMs);
    }
    const err: any = new Error('Import timed out');
    err.code = 'IMPORT_TIMEOUT';
    throw err;
  }

  /**
   * Starts import and blocks until the job finishes (no live progress; use startProductImport + getImportJob for that).
   */
  async importProducts(
    file: File,
    mode: ProductImportMode,
    matchKey: ProductImportMatchKey = 'sku',
  ): Promise<ProductImportResult> {
    const started = await this.startProductImport(file, mode, matchKey);
    const job = await this.waitForImportJob(started.jobId);
    return { ok: true, job };
  }

  async getSelloSettings(): Promise<SelloSettings | null> {
    return this.request('/products/sello-settings');
  }

  async putSelloSettings(data: { apiKey?: string }): Promise<SelloSettings> {
    return this.request('/products/sello-settings', {
      method: 'PUT',
      body: JSON.stringify(data || {}),
    });
  }
}

export const productsApi = new ProductsApi();
