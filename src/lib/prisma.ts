import "dotenv/config"
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

function createClient() {
  const rawUrl = process.env.DATABASE_URL!
  const { hostname } = new URL(rawUrl)
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'

  const adapter = isLocal
    ? new PrismaPg({ connectionString: rawUrl })
    : new PrismaPg(new pg.Pool({
        connectionString: rawUrl,
        ssl: { rejectUnauthorized: false }, // RDS; URL also carries sslmode=no-verify
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 20,
        query_timeout: 30000,
      }))

  // Long bulk transactions pass their own timeout.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 20000, timeout: 15000 } })
}

// Reuse across dev hot reloads so each edit doesn't open a new pool.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> }
const prisma = globalForPrisma.prisma ?? createClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export { prisma }
