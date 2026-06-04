import dns from 'dns';
import { execSync } from 'child_process';
import mongoose from 'mongoose';
import { env } from './env';

dns.setDefaultResultOrder('ipv4first');

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  family: 4 as const,
};

function parseSrvViaNslookup(clusterHost: string): { hosts: string[]; options: string } | null {
  try {
    const srvOutput = execSync(`nslookup -type=SRV _mongodb._tcp.${clusterHost}`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const hosts: string[] = [];
    let pendingPort: string | null = null;

    for (const line of srvOutput.split(/\r?\n/)) {
      const portMatch = line.match(/port\s*=\s*(\d+)/i);
      if (portMatch) pendingPort = portMatch[1];

      const hostMatch = line.match(/svr hostname\s*=\s*(\S+)/i);
      if (hostMatch && pendingPort) {
        hosts.push(`${hostMatch[1]}:${pendingPort}`);
        pendingPort = null;
      }
    }

    if (!hosts.length) return null;

    let options = 'authSource=admin&ssl=true';
    try {
      const txtOutput = execSync(`nslookup -type=TXT _mongodb._tcp.${clusterHost}`, {
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const txtMatch = txtOutput.match(/"([^"]+)"/);
      if (txtMatch) options = txtMatch[1];
    } catch {
      // TXT lookup optional; defaults above are fine for Atlas
    }

    return { hosts, options };
  } catch {
    return null;
  }
}

function srvToStandardUri(srvUri: string): string {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^/]+)@([^/?]+)(\/[^?]*)?(\?.*)?$/);
  if (!match) return srvUri;

  const [, credentials, clusterHost, dbPath = '', query = ''] = match;
  const resolved = parseSrvViaNslookup(clusterHost);
  if (!resolved) {
    throw new Error(
      `Cannot resolve MongoDB Atlas SRV record for ${clusterHost}. ` +
        'Check your network/DNS or use a standard mongodb:// connection string from Atlas.'
    );
  }

  const params = new URLSearchParams(query.replace(/^\?/, ''));
  for (const part of resolved.options.split('&')) {
    const [key, value] = part.split('=');
    if (key && value) params.set(key, value);
  }
  if (!params.has('ssl')) params.set('ssl', 'true');

  return `mongodb://${credentials}@${resolved.hosts.join(',')}${dbPath}?${params.toString()}`;
}

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  try {
    const clusterHost = uri.match(/^mongodb\+srv:\/\/[^/]+@([^/?]+)/)?.[1];
    if (clusterHost) {
      await dns.promises.resolveSrv(`_mongodb._tcp.${clusterHost}`);
    }
    return uri;
  } catch {
    console.warn('MongoDB SRV DNS lookup failed — converting to standard connection string...');
    return srvToStandardUri(uri);
  }
}

export async function connectDatabase(): Promise<void> {
  const uri = await resolveMongoUri(env.mongodbUri);
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, CONNECT_OPTIONS);
    console.log(`MongoDB connected (${mongoose.connection.db?.databaseName})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('MongoDB connection failed:', message);

    if (/authentication failed|bad auth/i.test(message)) {
      console.error(
        'Check MONGODB_URI username/password in backend/.env (URL-encode @ as %40 in passwords).'
      );
    } else if (/timed out|ECONNREFUSED/i.test(message)) {
      console.error(
        'Check MongoDB Atlas → Network Access and allow your current IP (or 0.0.0.0/0 for testing).'
      );
    }

    throw err;
  }
}
