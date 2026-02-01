import { Task } from '../types/tasks';

// Tasks API following same pattern as estimates
class TasksApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getTasks(): Promise<Task[]> {
    const tasks = await this.request('/tasks');
    return tasks.map((task: any) => ({
      ...task,
      assignedTo: task.assigned_to, // Transform assigned_to to assignedTo
      createdFromNote: task.created_from_note, // Transform created_from_note to createdFromNote
      dueDate: task.due_date ? new Date(task.due_date) : null, // Transform due_date to dueDate
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
    console.log('tasksApi sending to backend:', {
      assigned_to: taskData.assignedTo,
      title: taskData.title,
    });

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
