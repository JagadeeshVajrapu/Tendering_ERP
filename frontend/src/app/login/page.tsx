'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore, getDashboardPath } from '@/stores/authStore';
import { normalizeUserRole } from '@/lib/roles';
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from '@/lib/branding';
import { FileText, Loader2, Shield, Sparkles, Lock, Mail } from 'lucide-react';

const demoAccounts = [
  { email: 'admin@tendererp.com', role: 'Admin', accent: 'border-violet-200 bg-violet-50 hover:bg-violet-100' },
  { email: 'executive@tendererp.com', role: 'Executive', accent: 'border-blue-200 bg-blue-50 hover:bg-blue-100' },
  { email: 'md@tendererp.com', role: 'MD', accent: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100' },
  { email: 'finance1@tendererp.com', role: 'Finance', accent: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100' },
  { email: 'manager@tendererp.com', role: 'Manager', accent: 'border-purple-200 bg-purple-50 hover:bg-purple-100' },
];

const highlights = [
  'AI-powered NIT analysis & feasibility reports',
  'End-to-end submission, finance & contract tracking',
  'Role-based dashboards for every stakeholder',
];

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, token, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('executive@tendererp.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !token || !user) return;
    const role = normalizeUserRole(user.role);
    if (role) router.replace(getDashboardPath(role));
  }, [mounted, token, user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      const profile = res.data.user;
      const role = normalizeUserRole(profile.role);
      if (!role) {
        setError('Your account has an invalid role. Contact an administrator.');
        return;
      }
      setAuth(res.data.token, { ...profile, role });
      router.replace(getDashboardPath(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Brand panel */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-sm">
            <FileText className="h-7 w-7 text-blue-200" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
            <p className="text-xs text-blue-200/80">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            Enterprise Tender Management
          </div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Streamline tenders.
            <br />
            <span className="text-blue-300">Submit with confidence.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">{APP_DESCRIPTION}</p>
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                <Shield className="h-4 w-4 shrink-0 text-blue-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© 2026 {APP_NAME}. All rights reserved.</p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-700" />
              <span className="text-lg font-bold">{APP_NAME}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{APP_TAGLINE}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your role-based workspace</p>
            </div>

            {!mounted ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 rounded-lg bg-slate-100" />
                <div className="h-10 rounded-lg bg-slate-100" />
                <div className="h-10 rounded-lg bg-slate-100" />
              </div>
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="h-11 w-full text-base font-medium" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </form>

                <div className="mt-8 border-t border-slate-100 pt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Demo accounts · password: password123
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {demoAccounts.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => {
                          setEmail(acc.email);
                          setError('');
                        }}
                        className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${acc.accent} ${
                          email === acc.email ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                        }`}
                      >
                        <span className="font-semibold text-slate-800">{acc.role}</span>
                        <br />
                        <span className="text-muted-foreground">{acc.email.split('@')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
