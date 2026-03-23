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
    connectionTimeoutMillis: 5000,
  })
  adapter = new PrismaPg(pool)
}

const prisma = new PrismaClient({ adapter })
export { prisma }
