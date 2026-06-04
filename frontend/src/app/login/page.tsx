'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore, getDashboardPath } from '@/stores/authStore';
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from '@/lib/branding';
import { FileText } from 'lucide-react';

const demoAccounts = [
  { email: 'executive@tendererp.com', role: 'Executive' },
  { email: 'md@tendererp.com', role: 'MD' },
  { email: 'finance1@tendererp.com', role: 'Finance' },
  { email: 'manager@tendererp.com', role: 'Manager' },
];

function LoginFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-4 w-12 rounded bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
      </div>
      <div className="h-10 rounded-md bg-muted" />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('executive@tendererp.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      setAuth(res.data.token, res.data.user);
      router.push(getDashboardPath(res.data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8" />
          <span className="text-2xl font-bold">{APP_NAME}</span>
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-blue-300">{APP_TAGLINE}</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight">
            Enterprise Tender
            <br />
            Management System
          </h2>
          <p className="mt-4 max-w-md text-slate-300">{APP_DESCRIPTION}</p>
        </div>
        <p className="text-sm text-slate-500">© 2026 {APP_NAME}. All rights reserved.</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader>
            <div className="mb-2 lg:hidden">
              <p className="text-xl font-bold">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
            </div>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Access your role-based dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {!mounted ? (
              <LoginFormSkeleton />
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </form>
                <div className="mt-6">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Demo accounts (password: password123)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {demoAccounts.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => setEmail(acc.email)}
                        className="rounded-lg border px-3 py-2 text-left text-xs hover:bg-slate-50"
                      >
                        <span className="font-medium">{acc.role}</span>
                        <br />
                        <span className="text-muted-foreground">{acc.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
