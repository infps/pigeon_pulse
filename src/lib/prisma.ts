import "dotenv/config"
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../generated/prisma/client'

const url = new URL(process.env.DATABASE_URL!)
const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

let adapter: PrismaPg | PrismaNeon

if (isLocal) {
  adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
} else {
  // Neon serverless: HTTP fetch per query — no TCP/TLS handshake overhead.
  // Falls back to pg.Pool only if adapter-neon is unavailable.
  adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
}

// Default 5s interactive-transaction timeout is too tight for many-write transactions
// over a remote (Neon) DB — raise globally so register/payouts/etc don't hit P2028.
const prisma = new PrismaClient({ adapter, transactionOptions: { maxWait: 20000, timeout: 180000 } })
export { prisma }
