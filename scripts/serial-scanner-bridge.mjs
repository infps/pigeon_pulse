#!/usr/bin/env node
/**
 * RS-232 scanner bridge.
 *
 * HayLoft talked to a serial reader on COM1 at 19200 baud, configured in
 * HayLoft.properties:
 *
 *   rs.device=COM1  rs.rate=19200  rs.data=8  rs.parity=odd  rs.stop=1
 *
 * Pigeon Pulse expects a networked reader that speaks HTTP, so a club still on
 * the serial hardware had no way in. This bridge is that way in: it reads tags
 * off the serial port and posts them to /api/scanner/push, which is the same
 * endpoint the network readers use. Nothing server-side has to know the
 * difference.
 *
 * It deliberately lives outside the web app — it has to run on the machine the
 * reader is plugged into, which is not the machine running the site.
 *
 * Setup (once, on the scanning machine):
 *
 *   npm install serialport
 *
 * Run:
 *
 *   node scripts/serial-scanner-bridge.mjs \
 *     --port COM1 --baud 19200 --parity odd \
 *     --url http://localhost:3000/api/scanner/push \
 *     --scanner LOFT-PEN-3 --season 11
 *
 * The --scanner value is the serial the server maps to a loft section, so give
 * each reader its own and map it once in the Groups tab.
 */

const args = process.argv.slice(2);

function arg(name, fallback = undefined) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return fallback;
  return args[i + 1];
}

const hasFlag = (name) => args.includes(`--${name}`);

const config = {
  port: arg("port", "COM1"),
  baud: Number(arg("baud", "19200")),
  dataBits: Number(arg("data", "8")),
  parity: arg("parity", "odd"),
  stopBits: Number(arg("stop", "1")),
  url: arg("url", "http://localhost:3000/api/scanner/push"),
  scanner: arg("scanner", `serial-${arg("port", "COM1")}`),
  seasonId: arg("season") ? Number(arg("season")) : undefined,
  // A reader often re-reads the same tag while a bird sits on the pad.
  dedupeMs: Number(arg("dedupe", "4000")),
  dryRun: hasFlag("dry-run"),
  verbose: hasFlag("verbose"),
};

if (hasFlag("help")) {
  console.log(
    [
      "Serial scanner bridge — reads RFID tags from a COM port and posts them to Pigeon Pulse.",
      "",
      "  --port COM1          serial device (default COM1)",
      "  --baud 19200         baud rate (default 19200, matching HayLoft)",
      "  --data 8             data bits (default 8)",
      "  --parity odd         none | even | odd | mark | space (default odd)",
      "  --stop 1             stop bits (default 1)",
      "  --url URL            endpoint (default http://localhost:3000/api/scanner/push)",
      "  --scanner SERIAL     the serial the server maps to a loft section",
      "  --season 11          season to file birds into (optional)",
      "  --dedupe 4000        ignore the same tag again within this many ms",
      "  --dry-run            read and print, post nothing",
      "  --verbose            print every line received, matched or not",
      "",
      "Requires: npm install serialport",
    ].join("\n")
  );
  process.exit(0);
}

let SerialPort;
try {
  // Imported dynamically so the web app never has to carry a native dependency
  // it does not use.
  ({ SerialPort } = await import("serialport"));
} catch {
  console.error(
    [
      "The 'serialport' package is not installed.",
      "",
      "On the machine the reader is plugged into, run:",
      "  npm install serialport",
      "",
      "Then start this bridge again.",
    ].join("\n")
  );
  process.exit(1);
}

const recent = new Map();

function seenRecently(tag) {
  const now = Date.now();
  // Keep the map from growing without bound over a long shift.
  for (const [key, at] of recent) {
    if (now - at > config.dedupeMs * 4) recent.delete(key);
  }
  const last = recent.get(tag);
  recent.set(tag, now);
  return last != null && now - last < config.dedupeMs;
}

/**
 * Pull tag-looking tokens out of a line.
 *
 * Serial readers are not consistent: some send a bare tag, some prefix it, some
 * append a checksum. Anything alphanumeric and long enough to be a tag counts,
 * which is more forgiving than assuming one vendor's format.
 */
function extractTags(line) {
  return (line.match(/[A-Za-z0-9._-]{6,}/g) ?? []).filter((t) => /\d/.test(t));
}

let posted = 0;
let skipped = 0;
let failed = 0;

async function post(tag) {
  if (config.dryRun) {
    console.log(`[dry-run] would post ${tag}`);
    return;
  }
  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rfidTag: tag,
        scannerId: config.scanner,
        ...(config.seasonId != null ? { seasonId: config.seasonId } : {}),
      }),
    });

    if (!res.ok) {
      failed++;
      const text = await res.text().catch(() => "");
      console.error(`${tag}: HTTP ${res.status} ${text.slice(0, 120)}`);
      return;
    }

    posted++;
    const data = await res.json().catch(() => ({}));
    const where = data.filedInto ? ` -> ${data.filedInto}` : "";
    const known = data.matchedBird === false ? " (unknown bird)" : "";
    console.log(`${tag}${where}${known}`);
  } catch (error) {
    failed++;
    // A dropped network must never kill the bridge — the reader keeps reading.
    console.error(`${tag}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(
  `Bridging ${config.port} @ ${config.baud} ${config.dataBits}-${config.parity}-${config.stopBits} ` +
    `as "${config.scanner}" -> ${config.url}${config.dryRun ? " (dry run)" : ""}`
);

const port = new SerialPort({
  path: config.port,
  baudRate: config.baud,
  dataBits: config.dataBits,
  parity: config.parity,
  stopBits: config.stopBits,
  autoOpen: true,
});

let buffer = "";

port.on("open", () => console.log(`${config.port} open. Waiting for scans. Ctrl+C to stop.`));

port.on("data", (chunk) => {
  buffer += chunk.toString("ascii");

  // Readers terminate with CR, LF or both; split on either and keep the tail.
  const lines = buffer.split(/\r\n|\r|\n/);
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (config.verbose) console.log(`< ${trimmed}`);

    for (const tag of extractTags(trimmed)) {
      if (seenRecently(tag)) {
        skipped++;
        if (config.verbose) console.log(`  (repeat within ${config.dedupeMs}ms, ignored)`);
        continue;
      }
      void post(tag);
    }
  }
});

port.on("error", (error) => {
  console.error(`Serial error: ${error.message}`);
  // An unplugged or busy port is fatal — there is nothing to read from.
  process.exit(1);
});

port.on("close", () => {
  console.error(`${config.port} closed.`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\nStopping. ${posted} posted, ${skipped} repeats ignored, ${failed} failed.`);
    port.close(() => process.exit(0));
  });
}
