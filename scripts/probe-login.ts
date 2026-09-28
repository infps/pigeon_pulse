/**
 * Does the endpoint the mobile app actually uses work?
 *
 * The app signs in at /auth/sign-in/username, not the email route, and reads a
 * bearer token out of the response body rather than a cookie. Either of those
 * can break independently of the other, so this checks the exact shape the app
 * depends on.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const BASE = process.argv[2] ?? "http://192.168.1.190:3000";
const USERNAME = `probe${Date.now()}`;
const EMAIL = `${USERNAME}@pigeonpulse.test`;
const PASSWORD = "Probe-Passw0rd!";

const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Probe", username: USERNAME }),
});
console.log(`sign-up            -> ${signup.status}`);
if (!signup.ok) console.log(`  ${(await signup.text()).slice(0, 200)}`);

const user = await prisma.user.findUnique({
  where: { email: EMAIL },
  select: { id: true, username: true, approvalStatus: true },
});
console.log(`  stored username  -> ${user?.username ?? "(none)"}`);
console.log(`  approvalStatus   -> ${user?.approvalStatus ?? "(none)"}`);

const byUsername = await fetch(`${BASE}/api/auth/sign-in/username`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
});
const body = await byUsername.text();
console.log(`sign-in/username   -> ${byUsername.status}`);
console.log(`  body             -> ${body.slice(0, 260)}`);

let parsed: any = {};
try { parsed = JSON.parse(body); } catch {}
console.log(`  has .token        -> ${Boolean(parsed?.token)}`);
console.log(`  set-auth-token hdr-> ${byUsername.headers.get("set-auth-token") ? "yes" : "no"}`);

if (user) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
