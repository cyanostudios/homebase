import { Task } from '../types/tasks';

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

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`/api${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));

      const errorMessage = error.error || error.message || 'Request failed';
      const errorCode = error.code;
      const errorDetails = error.details;

      if (errorCode === 'VALIDATION_ERROR' && errorDetails) {
        console.error('Validation errors:', errorDetails);
      }

      const err: any = new Error(errorMessage);
      err.status = response.status;
      err.code = errorCode;
      err.details = errorDetails;

      throw err;
    }

    return response.json();
  }

  async getTasks(): Promise<Task[]> {
    const tasks = await this.request('/tasks');
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
    const task = await this.request(`/tasks/${id}`);
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

    const task = await this.request('/tasks', {
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
    const task = await this.request(`/tasks/${id}`, {
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
    await this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }
}

export const tasksApi = new TasksApi();
