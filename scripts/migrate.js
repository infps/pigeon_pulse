// Keep a live connection during migrate so Neon doesn't suspend between warmup and advisory lock
const { spawn } = require("child_process");
const { Client } = require("pg");

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url });

  let retries = 6;
  while (retries--) {
    try {
      await client.connect();
      await client.query("SELECT 1");
      break;
    } catch (e) {
      console.log(`Warmup failed: ${e.message}, retrying...`);
      await client.end().catch(() => {});
      if (!retries) { console.error("DB never woke up"); process.exit(1); }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log("DB warm — running migrations (connection held open)");

  // Keep client connected so Neon compute stays alive during migrate
  const code = await new Promise((resolve) => {
    const proc = spawn("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: process.env,
    });
    proc.on("close", resolve);
  });

  await client.end().catch(() => {});

  if (code !== 0) process.exit(code);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
