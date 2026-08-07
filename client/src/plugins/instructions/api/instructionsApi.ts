import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type {
  Instruction,
  InstructionCategory,
  InstructionPayload,
  ValidationError,
} from '../types/instructions';

const request = createApiClient('/instructions');

type ApiError = ApiRequestError & { errors?: ValidationError[] };

function mapValidationDetails(err: ApiError): ApiError {
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return err;
  }
  if (Array.isArray(err.details)) {
    err.errors = err.details.map(
      (d: { path?: string; msg?: string; field?: string; message?: string }) => ({
        field: d.path ?? d.field ?? 'general',
        message: d.msg ?? d.message ?? 'Invalid',
      }),
    );
  }
  return err;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return (await request(path, options)) as T;
  } catch (err) {
    throw mapValidationDetails(err as ApiError);
  }
}

function normalizeInstruction(row: Instruction): Instruction {
  return {
    ...row,
    id: String(row.id),
    steps: Array.isArray(row.steps)
      ? row.steps.map((step, index) => ({
          ...step,
          id: step.id != null ? String(step.id) : undefined,
          sequenceOrder: step.sequenceOrder ?? index + 1,
          description: step.description ?? null,
          imageUrl: step.imageUrl ?? null,
        }))
      : row.steps,
  };
}

function normalizeCategory(row: InstructionCategory): InstructionCategory {
  return {
    ...row,
    id: String(row.id),
    name: row.name ?? '',
    sortOrder: row.sortOrder ?? 1,
  };
}

class InstructionsApi {
  async getInstructions(): Promise<Instruction[]> {
    const rows = await apiRequest<Instruction[]>('');
    return (rows || []).map(normalizeInstruction);
  }

  async getInstruction(id: string): Promise<Instruction> {
    const row = await apiRequest<Instruction>(`/${id}`);
    return normalizeInstruction(row);
  }

  createInstruction(payload: InstructionPayload) {
    return apiRequest<Instruction>('', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeInstruction);
  }

  updateInstruction(id: string, payload: InstructionPayload) {
    return apiRequest<Instruction>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then(normalizeInstruction);
  }

  deleteInstruction(id: string) {
    return apiRequest<{ deleted: boolean }>(`/${id}`, { method: 'DELETE' });
  }

  deleteInstructionsBatch(ids: string[]) {
    return apiRequest<{ deleted: number }>('/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids: ids.map((id) => Number(id) || id) }),
    });
  }

  reorderInstructions(category: string | null, orderedIds: string[]) {
    return apiRequest<Instruction[]>('/reorder', {
      method: 'PUT',
      body: JSON.stringify({ category, orderedIds }),
    }).then((rows) => (rows || []).map(normalizeInstruction));
  }

  async getCategories(): Promise<InstructionCategory[]> {
    const rows = await apiRequest<InstructionCategory[]>('/categories');
    return (rows || []).map(normalizeCategory);
  }

  createCategory(name: string) {
    return apiRequest<InstructionCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then(normalizeCategory);
  }

  reorderCategories(orderedIds: string[]) {
    return apiRequest<InstructionCategory[]>('/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }).then((rows) => (rows || []).map(normalizeCategory));
  }

  deleteCategory(id: string, options?: { moveToCategory: string | null }) {
    const body =
      options && Object.prototype.hasOwnProperty.call(options, 'moveToCategory')
        ? JSON.stringify({ moveToCategory: options.moveToCategory })
        : undefined;
    return apiRequest<{
      message: string;
      id: string;
      movedItemCount?: number;
      moveToCategory?: string | null;
    }>(`/categories/${id}`, {
      method: 'DELETE',
      ...(body ? { body } : {}),
    });
  }
}

export const instructionsApi = new InstructionsApi();
