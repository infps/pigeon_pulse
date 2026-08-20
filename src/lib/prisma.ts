import "dotenv/config"
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const rawUrl = process.env.DATABASE_URL!
const url = new URL(rawUrl)
const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
const isPooler = url.hostname.includes('-pooler.')

let adapter: PrismaPg

if (isLocal) {
  adapter = new PrismaPg({ connectionString: rawUrl })
} else {
  // Pooler: small pool — pgbouncer manages real connections. keepAlive off.
  // Direct: larger pool + keepAlive to survive Neon compute cold starts.
  const pool = new pg.Pool({
    connectionString: rawUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: isPooler ? 60000 : 30000,
    keepAlive: !isPooler,
    max: isPooler ? 5 : 20,
  })
  adapter = new PrismaPg(pool)
}

const prisma = new PrismaClient({ adapter, transactionOptions: { maxWait: 20000, timeout: 180000 } })

// Keep Neon compute warm — ping every 4 min to stay under the 5 min suspend threshold.
// Only runs in long-lived server process (next start), skipped in test/local.
if (!isLocal && process.env.NODE_ENV === "production") {
  setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch(() => {});
  }, 4 * 60 * 1000);
}

export { prisma }
