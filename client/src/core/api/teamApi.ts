// Team API - List/add/update/remove account members (credentials: include for session cookies)

export interface TeamMember {
  id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export interface TeamMembersResponse {
  members: TeamMember[];
}

export interface AddMemberParams {
  email: string;
  password?: string;
  role?: 'user' | 'editor' | 'admin';
}

class TeamApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async listMembers(): Promise<TeamMembersResponse> {
    return this.request('/api/team/users', { method: 'GET' });
  }

  async addMember(params: AddMemberParams): Promise<{ id: number; email: string; role: string }> {
    return this.request('/api/team/users', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email.trim(),
        password: params.password || undefined,
        role: params.role || 'user',
      }),
    });
  }

  async updateRole(userId: number, role: 'user' | 'editor' | 'admin'): Promise<{ userId: number }> {
    return this.request(`/api/team/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeMember(userId: number): Promise<{ message: string; userId: number }> {
    return this.request(`/api/team/users/${userId}`, { method: 'DELETE' });
  }
}

export const teamApi = new TeamApi();
