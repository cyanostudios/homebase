import { Task } from '../types/tasks';

// Tasks API - V2 with CSRF protection
class TasksApi {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSRF token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });

        if (response.status === 401) {
          throw new Error('Session required. Please log in again.');
        } else if (response.status === 503) {
          throw new Error('CSRF protection not configured on server');
        } else {
          throw new Error(`Failed to get CSRF token: ${errorData.error || response.statusText}`);
        }
      }

      const data = await response.json();
      if (!data.csrfToken) {
        throw new Error('CSRF token not found in response');
      }

      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error: any) {
      console.error('CSRF token fetch failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get CSRF token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add CSRF token for mutations
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers["X-CSRF-Token"] = await this.getCsrfToken();
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));

      // Handle standardized error format from backend
      const errorMessage = error.error || error.message || 'Request failed';
      const errorCode = error.code;
      const errorDetails = error.details;

      // Log validation errors for debugging
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
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
    };
  }

  async createTask(taskData: any): Promise<Task> {
    // Transform camelCase to snake_case for backend
    // Remove both camelCase and snake_case versions to avoid duplicates
    const {
      dueDate,
      assignedTo,
      createdFromNote,
      due_date,
      assigned_to,
      created_from_note,
      ...rest
    } = taskData;

    // Ensure required fields are strings/arrays
    const title = rest.title || '';
    const content = rest.content || '';
    const mentions = Array.isArray(rest.mentions) ? rest.mentions : [];
    const status = rest.status || 'not started';
    const priority = rest.priority ?? 'Medium'; // Use nullish coalescing to preserve 'Low' if set

    console.log('Creating task with data:', {
      title,
      content,
      mentions,
      status,
      priority,
      due_date: dueDate instanceof Date ? dueDate.toISOString().split('T')[0] : dueDate || null,
      assigned_to: assignedTo || null,
      created_from_note: createdFromNote || null,
    });

    // Build request body, only include fields that have values
    const requestBody: any = {
      title: title,
      content: content,
      mentions: mentions,
      status: status,
      priority: priority,
    };

    // Only include optional fields if they have values
    if (dueDate instanceof Date) {
      requestBody.due_date = dueDate.toISOString().split('T')[0];
    }
    if (assignedTo) {
      requestBody.assigned_to = assignedTo;
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
      createdFromNote: task.created_from_note,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at),
    };
  }

  async updateTask(id: string, taskData: any): Promise<Task> {
    // Transform camelCase to snake_case for backend
    const { dueDate, assignedTo, createdFromNote, ...rest } = taskData;
    const task = await this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...rest,
        due_date: dueDate instanceof Date ? dueDate.toISOString().split('T')[0] : dueDate || null,
        assigned_to: assignedTo || null,
        created_from_note: createdFromNote || null,
      }),
    });
    return {
      ...task,
      assignedTo: task.assigned_to,
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

  async bulkDelete(ids: string[]): Promise<{ ok: boolean; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/tasks/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }
}

export const tasksApi = new TasksApi();
