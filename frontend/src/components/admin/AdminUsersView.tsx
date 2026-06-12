'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UserRole } from '@/types';
import type { AdminUser } from '@/types/adminDashboard';

const ROLES: UserRole[] = ['executive', 'md', 'finance', 'manager', 'admin'];

interface Props {
  token: string;
}

export function AdminUsersView({ token }: Props) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.listAdminUsers(token),
    enabled: !!token,
  });

  const updateUser = useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: { role?: string; isActive?: boolean };
    }) => api.updateAdminUser(token, userId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User updated successfully');
      setTimeout(() => setMessage(''), 3000);
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const users: AdminUser[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load users.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <Users className="h-4 w-4 text-violet-600" />
          <h2 className="text-sm font-semibold">User & Role Management</h2>
          <Badge variant="outline" className="ml-auto">
            {users.length} users
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.department || '—'}</TableCell>
                  <TableCell>
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm capitalize"
                      value={user.role}
                      disabled={updateUser.isPending}
                      onChange={(e) =>
                        updateUser.mutate({
                          userId: user.id,
                          body: { role: e.target.value },
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        user.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updateUser.isPending}
                      onClick={() =>
                        updateUser.mutate({
                          userId: user.id,
                          body: { isActive: !user.isActive },
                        })
                      }
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
