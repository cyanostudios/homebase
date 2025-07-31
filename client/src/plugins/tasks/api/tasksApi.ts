import { Task } from '../types/tasks';

const API_BASE = '/api/tasks';

export const tasksApi = {
  async getTasks(): Promise<Task[]> {
    const response = await fetch(API_BASE, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    
    const data = await response.json();
    
    // Transform API data to match interface
    return data.map((task: any) => ({
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
    }));
  },

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...taskData,
        due_date: taskData.dueDate?.toISOString().split('T')[0] || null,
        assigned_to: taskData.assignedTo || null,
        created_from_note: taskData.createdFromNote || null,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create task');
    }
    
    const data = await response.json();
    
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    };
  },

  async updateTask(id: string, taskData: Partial<Task>): Promise<Task> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...taskData,
        due_date: taskData.dueDate?.toISOString().split('T')[0] || null,
        assigned_to: taskData.assignedTo || null,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update task');
    }
    
    const data = await response.json();
    
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    };
  },

  async deleteTask(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete task');
    }
  },
};