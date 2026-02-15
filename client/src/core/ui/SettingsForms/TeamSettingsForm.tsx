// Team settings form: list members, add/update role/remove (admin only); read-only for non-admin.

import { Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { teamApi, TeamMember } from '@/core/api/teamApi';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

interface TeamSettingsFormProps {
  onCancel: () => void;
}

const ROLES: Array<'user' | 'editor' | 'admin'> = ['user', 'editor', 'admin'];

export function TeamSettingsForm({ onCancel: _onCancel }: TeamSettingsFormProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<'user' | 'editor' | 'admin'>('user');
  const [isAdding, setIsAdding] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{
    isOpen: boolean;
    member: TeamMember | null;
  }>({
    isOpen: false,
    member: null,
  });
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{
    isOpen: boolean;
    member: TeamMember | null;
    newRole: 'user' | 'editor' | 'admin' | null;
  }>({ isOpen: false, member: null, newRole: null });

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setTenantRole(data.tenantRole ?? null);
    } catch {
      setTenantRole(null);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { members: list } = await teamApi.listMembers();
      setMembers(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load members';
      setError(msg);
      console.error('Team listMembers failed', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const isAdmin = tenantRole === 'admin';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) {
      return;
    }
    setError(null);
    setIsAdding(true);
    try {
      await teamApi.addMember({
        email: addEmail.trim(),
        password: addPassword.trim() || undefined,
        role: addRole,
      });
      setAddEmail('');
      setAddPassword('');
      setAddRole('user');
      await loadMembers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add member';
      setError(msg);
      console.error('Team addMember failed', e);
    } finally {
      setIsAdding(false);
    }
  };

  const openRoleChangeConfirm = (member: TeamMember, newRole: 'user' | 'editor' | 'admin') => {
    setRoleChangeConfirm({ isOpen: true, member, newRole });
  };

  const cancelRoleChange = () => {
    setRoleChangeConfirm({ isOpen: false, member: null, newRole: null });
  };

  const saveRoleChange = async () => {
    const { member, newRole } = roleChangeConfirm;
    if (!member || !newRole) {
      setRoleChangeConfirm({ isOpen: false, member: null, newRole: null });
      return;
    }
    setError(null);
    setRoleChangeConfirm({ isOpen: false, member: null, newRole: null });
    setUpdatingUserId(member.id);
    try {
      await teamApi.updateRole(member.id, newRole);
      await loadMembers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update role';
      setError(msg);
      console.error('Team updateRole failed', e);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const openRemoveConfirm = (member: TeamMember) => {
    setRemoveConfirm({ isOpen: true, member });
  };

  const cancelRemove = () => {
    setRemoveConfirm({ isOpen: false, member: null });
  };

  const confirmRemove = async () => {
    const member = removeConfirm.member;
    if (!member) {
      setRemoveConfirm({ isOpen: false, member: null });
      return;
    }
    setError(null);
    setRemoveConfirm({ isOpen: false, member: null });
    try {
      await teamApi.removeMember(member.id);
      await loadMembers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove member';
      setError(msg);
      console.error('Team removeMember failed', e);
    }
  };

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <Card className="p-3 bg-muted/50 border-muted-foreground/20">
          <p className="text-sm text-muted-foreground">
            Read-only. Only admins can add or change members.
          </p>
        </Card>
      )}

      {error && (
        <Card className="p-3 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {isAdmin && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Add member</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="team-add-email">Email</Label>
              <Input
                id="team-add-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="team-add-password">Password (required for new users)</Label>
              <Input
                id="team-add-password"
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="team-add-role">Role</Label>
              <NativeSelect
                id="team-add-role"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as 'user' | 'editor' | 'admin')}
                className="mt-1 w-full"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isAdding}>
                {isAdding ? 'Adding...' : 'Add member'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="shadow-none">
        <h4 className="text-sm font-semibold p-4 pb-2">Members</h4>
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">Loading...</div>
        ) : members.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No members yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[120px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <NativeSelect
                        value={member.role}
                        onChange={(e) =>
                          openRoleChangeConfirm(
                            member,
                            e.target.value as 'user' | 'editor' | 'admin',
                          )
                        }
                        disabled={updatingUserId === member.id}
                        className="w-28"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      member.role
                    )}
                  </TableCell>
                  <TableCell>{member.status}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
                        onClick={() => openRemoveConfirm(member)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        isOpen={removeConfirm.isOpen}
        title="Remove member"
        message={
          removeConfirm.member
            ? `Are you sure you want to remove "${removeConfirm.member.email}" from the account?`
            : ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={roleChangeConfirm.isOpen}
        title="Change role"
        message={
          roleChangeConfirm.member && roleChangeConfirm.newRole
            ? `Change ${roleChangeConfirm.member.email}'s role to ${roleChangeConfirm.newRole.charAt(0).toUpperCase() + roleChangeConfirm.newRole.slice(1)}?`
            : ''
        }
        confirmText="Save"
        cancelText="Cancel"
        onConfirm={saveRoleChange}
        onCancel={cancelRoleChange}
        variant="warning"
      />
    </div>
  );
}
