import { env } from './env';

/** Allowed browser origins for API + Socket.IO (development-friendly). */
export function getAllowedOrigins(): (string | RegExp)[] {
  const origins = new Set<string>([
    env.frontendUrl,
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...env.corsOrigins,
  ]);

  const list: (string | RegExp)[] = [...origins];

  if (env.isDevelopment) {
    // WSL / LAN IP access (e.g. http://172.28.80.1:3001)
    list.push(/^https?:\/\/(localhost|127\.0\.0\.1|172\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):3001$/);
  }

  return list;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = getAllowedOrigins();
  return allowed.some((entry) =>
    typeof entry === 'string' ? entry === origin : entry.test(origin)
  );
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (!origin || isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  console.warn('[CORS] Blocked origin:', origin);
  callback(null, false);
}
