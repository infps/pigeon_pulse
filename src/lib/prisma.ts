import "dotenv/config"
import dns from 'dns/promises'
import net from 'net'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const url = new URL(process.env.DATABASE_URL!)
const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

async function findReachableIp(hostname: string, port: number): Promise<string> {
  const addrs = await dns.resolve4(hostname)
  for (const ip of addrs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = net.connect(port, ip)
        sock.setTimeout(2000)
        sock.on('connect', () => { sock.destroy(); resolve() })
        sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')) })
        sock.on('error', reject)
      })
      return ip
    } catch { continue }
  }
  throw new Error(`No reachable IP for ${hostname}`)
}

let adapter: PrismaPg

if (isLocal) {
  adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
} else {
  const ip = await findReachableIp(url.hostname, Number(url.port) || 5432)
  const pool = new pg.Pool({
    host: ip,
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
    ssl: { servername: url.hostname, rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })
  adapter = new PrismaPg(pool)
}

const prisma = new PrismaClient({ adapter })
export { prisma }
