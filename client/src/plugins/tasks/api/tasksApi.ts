import { Task } from '../types/tasks';

// Tasks API - V2 with CSRF protection
class TasksApi {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error('CSRF token fetch failed:', error);
      throw new Error('Failed to get CSRF token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add CSRF token for mutations
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers['X-CSRF-Token'] = await this.getCsrfToken();
    }

    const response = await fetch(`/api${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      
      // Handle standardized error format from backend
      const errorMessage = error.error || error.message || 'Request failed';
      const errorCode = error.code;
      const errorDetails = error.details;
      
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
    const task = await this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...taskData,
        due_date: taskData.dueDate?.toISOString().split('T')[0] || null,
        assigned_to: taskData.assignedTo || null,
        created_from_note: taskData.createdFromNote || null,
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

  async updateTask(id: string, taskData: any): Promise<Task> {
    const task = await this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...taskData,
        due_date: taskData.dueDate?.toISOString().split('T')[0] || null,
        assigned_to: taskData.assignedTo || null,
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
}

export const tasksApi = new TasksApi();
