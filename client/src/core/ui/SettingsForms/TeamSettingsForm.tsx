// Team settings: personal member profile + list/add/update/remove members (admin only for roster).

import { Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
import { useApp } from '@/core/api/AppContext';
import { teamApi, TeamMember } from '@/core/api/teamApi';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DETAIL_FIELD_LABEL_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { DetailSection } from '@/core/ui/DetailSection';
import { useSettingsContext } from '@/plugins/settings/context/SettingsContext';

interface TeamSettingsFormProps {
  onCancel: () => void;
}

const ROLES: Array<'user' | 'editor' | 'admin'> = ['user', 'editor', 'admin'];

export function TeamSettingsForm({ onCancel }: TeamSettingsFormProps) {
  const { user, getSettings, updateSettings } = useApp();
  const { registerSaveHandler, setIsSaving, setHasChanges } = useSettingsContext();

  const [personal, setPersonal] = useState({
    name: '',
    title: '',
    email: user?.email || '',
  });
  const [initialPersonal, setInitialPersonal] = useState({ name: '', title: '' });
  const [personalLoading, setPersonalLoading] = useState(true);

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

  const handleSavePersonal = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings('profile', {
        name: personal.name,
        title: personal.title,
      });
      setInitialPersonal({ name: personal.name, title: personal.title });
      setHasChanges(false);
      onCancel();
    } catch (error) {
      console.error('Failed to save personal profile:', error);
    } finally {
      setIsSaving(false);
    }
  }, [personal.name, personal.title, onCancel, updateSettings, setIsSaving, setHasChanges]);

  useEffect(() => {
    let cancelled = false;

    const loadPersonal = async () => {
      setPersonalLoading(true);
      try {
        const profileSettings = await getSettings('profile');
        if (cancelled) {
          return;
        }
        const name = profileSettings?.name || '';
        const title = profileSettings?.title || '';
        setPersonal({
          name,
          title,
          email: user?.email || '',
        });
        setInitialPersonal({ name, title });
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to load personal profile:', error);
      } finally {
        if (!cancelled) {
          setPersonalLoading(false);
        }
      }
    };

    void loadPersonal();
    return () => {
      cancelled = true;
    };
  }, [getSettings, setHasChanges, user?.email]);

  const isPersonalDirty = useMemo(() => {
    return personal.name !== initialPersonal.name || personal.title !== initialPersonal.title;
  }, [personal.name, personal.title, initialPersonal.name, initialPersonal.title]);

  useEffect(() => {
    setHasChanges(isPersonalDirty);
    return () => setHasChanges(false);
  }, [isPersonalDirty, setHasChanges]);

  useEffect(() => {
    registerSaveHandler(handleSavePersonal);
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSavePersonal]);

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
    <div className="space-y-3">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Your profile" className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Your name and title as a team member (not the shared account identity).
          </p>
          {personalLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="team-profile-name" className={DETAIL_FIELD_LABEL_CLASS}>
                  Name
                </Label>
                <Input
                  id="team-profile-name"
                  type="text"
                  value={personal.name}
                  onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label htmlFor="team-profile-title" className={DETAIL_FIELD_LABEL_CLASS}>
                  Title
                </Label>
                <Input
                  id="team-profile-title"
                  type="text"
                  value={personal.title}
                  onChange={(e) => setPersonal({ ...personal, title: e.target.value })}
                  placeholder="Enter your job title"
                />
              </div>
              <div>
                <Label htmlFor="team-profile-email" className={DETAIL_FIELD_LABEL_CLASS}>
                  Email
                </Label>
                <Input
                  id="team-profile-email"
                  type="email"
                  value={personal.email}
                  disabled
                  className="bg-muted"
                />
                <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
          )}
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Team members" className="p-4">
          <div className="space-y-4">
            {!isAdmin && (
              <div className="rounded-md border border-muted-foreground/20 bg-muted/50 px-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Read-only. Only admins can add or change members.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {isAdmin && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Add member</h4>
                <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="team-add-email" className={DETAIL_FIELD_LABEL_CLASS}>
                      Email
                    </Label>
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
                    <Label htmlFor="team-add-password" className={DETAIL_FIELD_LABEL_CLASS}>
                      Password (required for new users)
                    </Label>
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
                    <Label htmlFor="team-add-role" className={DETAIL_FIELD_LABEL_CLASS}>
                      Role
                    </Label>
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
              </div>
            )}

            <div className="rounded-md border overflow-hidden">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
              ) : members.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No members yet.
                </div>
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
            </div>
          </div>
        </DetailSection>
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
