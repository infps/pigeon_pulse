import "dotenv/config"
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const url = new URL(process.env.DATABASE_URL!)
const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

let adapter: PrismaPg

if (isLocal) {
  adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000, // Neon cold/burst connects can exceed 5s
    idleTimeoutMillis: 30000,       // keep connections warm to avoid re-connect churn
    keepAlive: true,
    max: 20,
  })
  adapter = new PrismaPg(pool)
}

// Default 5s interactive-transaction timeout is too tight for many-write transactions
// over a remote (Neon) DB — raise globally so register/payouts/etc don't hit P2028.
const prisma = new PrismaClient({ adapter, transactionOptions: { maxWait: 20000, timeout: 180000 } })
export { prisma }
