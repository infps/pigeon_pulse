// Warms up Neon (cold start), then runs prisma migrate deploy
const { execSync } = require("child_process");
const { Client } = require("pg");

async function warmup(url, retries = 6) {
  for (let i = 0; i < retries; i++) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("DB warm");
      return;
    } catch (e) {
      await client.end().catch(() => {});
      console.log(`Warmup ${i + 1}/${retries} failed: ${e.message}`);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("DB did not wake up in time");
}

warmup(process.env.DIRECT_URL || process.env.DATABASE_URL)
  .then(() => {
    execSync("pnpm exec prisma migrate deploy", { stdio: "inherit" });
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
