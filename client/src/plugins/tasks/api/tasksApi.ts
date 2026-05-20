import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type { CreateTaskShareRequest, PublicTask, Task, TaskShare } from '../types/tasks';

class TasksApi {
  private normalizeAssignedToIds(task: any): string[] {
    if (Array.isArray(task?.assigned_to_ids)) {
      return task.assigned_to_ids.map((id: any) => String(id));
    }
    if (task?.assigned_to !== null && task?.assigned_to !== undefined && task?.assigned_to !== '') {
      return [String(task.assigned_to)];
    }
    return [];
  }

  private _request = createApiClient('/tasks');

  private async request(path: string, options: RequestInit = {}) {
    try {
      return await this._request(path, options);
    } catch (err) {
      const apiErr = err as ApiRequestError;
      if (apiErr.code === 'VALIDATION_ERROR' && apiErr.details) {
        console.error('Validation errors:', apiErr.details);
      }
      throw err;
    }
  }

  async getTasks(): Promise<Task[]> {
    const tasks = await this.request('');
    return tasks.map((task: any) => ({
      ...task,
      assignedTo: task.assigned_to,
      assignedToIds: this.normalizeAssignedToIds(task),
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
    }));
  }

  async getTask(id: string): Promise<Task> {
    const task = await this.request(`/${id}`);
    return {
      ...task,
      assignedTo: task.assigned_to,
      assignedToIds: this.normalizeAssignedToIds(task),
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
    };
  }

  async createTask(taskData: any): Promise<Task> {
    const {
      dueDate,
      assignedTo,
      assignedToIds,
      createdFromNote,
      due_date,
      assigned_to,
      assigned_to_ids,
      created_from_note,
      ...rest
    } = taskData;

    const title = rest.title || '';
    const content = rest.content || '';
    const mentions = Array.isArray(rest.mentions) ? rest.mentions : [];
    const status = rest.status || 'not started';
    const priority = rest.priority ?? 'Medium';

    const requestBody: any = {
      title: title,
      content: content,
      mentions: mentions,
      status: status,
      priority: priority,
    };

    if (dueDate instanceof Date) {
      requestBody.due_date = dueDate.toISOString().split('T')[0];
    }
    const normalizedAssignedToIds = Array.isArray(assignedToIds)
      ? assignedToIds.map((id: any) => String(id))
      : assignedTo
        ? [String(assignedTo)]
        : [];
    requestBody.assigned_to_ids = normalizedAssignedToIds;
    if (normalizedAssignedToIds.length > 0) {
      requestBody.assigned_to = normalizedAssignedToIds[0];
    }
    if (createdFromNote) {
      requestBody.created_from_note = createdFromNote;
    }

    const task = await this.request('', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    return {
      ...task,
      assignedTo: task.assigned_to,
      assignedToIds: this.normalizeAssignedToIds(task),
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
    };
  }

  async updateTask(id: string, taskData: any): Promise<Task> {
    const { dueDate, assignedTo, assignedToIds, createdFromNote, ...rest } = taskData;
    const normalizedAssignedToIds = Array.isArray(assignedToIds)
      ? assignedToIds.map((id: any) => String(id))
      : assignedTo
        ? [String(assignedTo)]
        : [];
    const task = await this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...rest,
        due_date: dueDate instanceof Date ? dueDate.toISOString().split('T')[0] : dueDate || null,
        assigned_to: normalizedAssignedToIds[0] || null,
        assigned_to_ids: normalizedAssignedToIds,
        created_from_note: createdFromNote || null,
      }),
    });
    return {
      ...task,
      assignedTo: task.assigned_to,
      assignedToIds: this.normalizeAssignedToIds(task),
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
    };
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/${id}`, {
      method: 'DELETE',
    });
  }

  async createShare(request: CreateTaskShareRequest): Promise<TaskShare> {
    const share = await this.request('/shares', {
      method: 'POST',
      body: JSON.stringify({
        taskId: request.taskId,
        validUntil: request.validUntil.toISOString(),
      }),
    });
    return {
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    };
  }

  async getShares(taskId: string): Promise<TaskShare[]> {
    const shares = await this.request(`/${taskId}/shares`);
    return shares.map((share: any) => ({
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    }));
  }

  async revokeShare(shareId: string): Promise<void> {
    await this.request(`/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async getPublicTask(token: string): Promise<PublicTask> {
    const task = await this.request(`/public/${token}`);
    return {
      ...task,
      assignedTo: task.assigned_to,
      assignedToIds: this.normalizeAssignedToIds(task),
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
      shareValidUntil: new Date(task.shareValidUntil),
    };
  }
}

export const tasksApi = new TasksApi();

export const taskShareApi = {
  async createShare(request: CreateTaskShareRequest): Promise<TaskShare> {
    return tasksApi.createShare(request);
  },
  async getShares(taskId: string): Promise<TaskShare[]> {
    return tasksApi.getShares(taskId);
  },
  async revokeShare(shareId: string): Promise<void> {
    return tasksApi.revokeShare(shareId);
  },
  async getPublicTask(token: string): Promise<PublicTask> {
    return tasksApi.getPublicTask(token);
  },
  generateShareUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/task/${token}`;
  },
};
