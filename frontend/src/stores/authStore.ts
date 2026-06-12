import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { getRoleDashboardPath, normalizeUserRole } from '@/lib/roles';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        const role = normalizeUserRole(user.role);
        if (!role) {
          set({ token: null, user: null });
          return;
        }
        set({ token, user: { ...user, role } });
      },
      updateUser: (user) => {
        const role = normalizeUserRole(user.role);
        if (!role) return;
        set({ user: { ...user, role } });
      },
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'tender-erp-auth' }
  )
);

export function getDashboardPath(role: string): string {
  return getRoleDashboardPath(role);
}
