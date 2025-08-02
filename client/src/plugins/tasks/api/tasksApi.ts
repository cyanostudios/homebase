const API_BASE = '/api/tasks';

export const tasksApi = {
  async getTasks() {
    const response = await fetch(API_BASE, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    
    return response.json();
  },

  async createTask(taskData: any) {
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
    
    return response.json();
  },

  async updateTask(id: string, taskData: any) {
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
    
    return response.json();
  },

  async deleteTask(id: string) {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete task');
    }
  },
};