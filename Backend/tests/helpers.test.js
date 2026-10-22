const test = require("node:test");
const assert = require("node:assert");
const { sunTimes, moonPhase } = require("../utils/astro");
const { addMinutes, minutesBetween, localParts } = require("../utils/time");
const { generateSecret, verifyTotp, codeAt, base32Encode, otpauthUri } = require("../utils/totp");
const { encrypt, decrypt, sha256 } = require("../utils/crypto");
const { memo } = require("../utils/cache");
const { normalFor, compareToNormal } = require("../utils/climate");
const { describeCode } = require("../utils/conditions");

test("time helpers add and compare local clock times", () => {
  assert.strictEqual(addMinutes("2026-10-12T23:30", 45), "2026-10-13T00:15");
  assert.strictEqual(minutesBetween("2026-10-12T06:19", "2026-10-12T17:57"), 698);
  assert.strictEqual(localParts(new Date("2026-10-12T08:30:00Z"), "Asia/Kolkata").iso, "2026-10-12T14:00");
});

test("sunrise and sunset for Delhi are close to the published times", () => {
  const { sunrise, sunset } = sunTimes(new Date("2026-10-12T12:00:00Z"), 28.61, 77.21);
  const ist = (d) => localParts(d, "Asia/Kolkata").iso.slice(11);
  const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  assert.ok(Math.abs(mins(ist(sunrise)) - (6 * 60 + 19)) <= 8, `sunrise ${ist(sunrise)}`);
  assert.ok(Math.abs(mins(ist(sunset)) - (17 * 60 + 56)) <= 8, `sunset ${ist(sunset)}`);
});

test("sun never rises inside the polar night", () => {
  assert.strictEqual(sunTimes(new Date("2026-12-21T12:00:00Z"), 80, 20), null);
});

test("moon phase matches known full and new moons", () => {
  assert.ok(moonPhase(new Date("2025-10-07T04:00:00Z")).illumination >= 97);
  assert.strictEqual(moonPhase(new Date("2025-10-07T04:00:00Z")).phase, "fullMoon");
  assert.ok(moonPhase(new Date("2025-10-21T12:00:00Z")).illumination <= 3);
});

test("TOTP matches the RFC 6238 test vector", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.strictEqual(codeAt(secret, Math.floor(59 / 30)), "287082");
  assert.strictEqual(codeAt(secret, Math.floor(1111111109 / 30)), "081804");
});

test("TOTP verify accepts the current code, rejects wrong ones, and reports the step", () => {
  const secret = generateSecret();
  const now = Date.now();
  const step = Math.floor(now / 30000);
  assert.strictEqual(verifyTotp(secret, codeAt(secret, step), now), step);
  assert.strictEqual(verifyTotp(secret, codeAt(secret, step - 1), now), step - 1); // 30s clock drift allowed
  assert.strictEqual(verifyTotp(secret, codeAt(secret, step - 5), now), null);
  assert.strictEqual(verifyTotp(secret, "12345", now), null);
  assert.strictEqual(verifyTotp(secret, "abcdef", now), null);
  assert.match(otpauthUri(secret, "a@b.com", "MellowWeather"), /^otpauth:\/\/totp\/MellowWeather:a%40b\.com\?secret=/);
});

test("encryption round-trips and tampering is detected", () => {
  process.env.SESSION_SECRET = "unit-test-secret";
  const sealed = encrypt("JBSWY3DPEHPK3PXP");
  assert.notStrictEqual(sealed, "JBSWY3DPEHPK3PXP");
  assert.strictEqual(decrypt(sealed), "JBSWY3DPEHPK3PXP");
  const parts = sealed.split(":");
  parts[2] = parts[2].replace(/.$/, parts[2].endsWith("0") ? "1" : "0");
  assert.throws(() => decrypt(parts.join(":")));
  assert.strictEqual(sha256("a").length, 64);
});

test("cache reuses answers, shares in-flight calls and never caches failures", async () => {
  let calls = 0;
  const load = () => new Promise((r) => setTimeout(() => r(++calls), 10));
  const [a, b] = await Promise.all([memo("t", "k", 1000, load), memo("t", "k", 1000, load)]);
  assert.strictEqual(a, 1); assert.strictEqual(b, 1);
  assert.strictEqual(await memo("t", "k", 1000, load), 1);
  let fails = 0;
  await assert.rejects(memo("t", "bad", 1000, async () => { fails++; throw new Error("x"); }));
  await assert.rejects(memo("t", "bad", 1000, async () => { fails++; throw new Error("x"); }));
  assert.strictEqual(fails, 2);
});

test("climate normals and comparison", () => {
  const dates = [], tmax = [], tmin = [], precip = [];
  for (let y = 2016; y <= 2025; y++) for (let m = 0; m < 12; m++) for (let d = 1; d <= 28; d++) {
    dates.push(new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)); tmax.push(30); tmin.push(20); precip.push(d % 4 === 0 ? 5 : 0);
  }
  const normal = normalFor({ dates, tmax, tmin, precip }, "2026-10-12");
  assert.strictEqual(normal.mean, 25);
  assert.ok(normal.rainyShare > 0 && normal.rainyShare < 0.5);
  assert.deepStrictEqual(compareToNormal(normal, 34, 24), { key: "warmer", deltaC: 4, normalMeanC: 25 });
  assert.strictEqual(compareToNormal(normal, 30, 20).key, "typical");
  assert.strictEqual(compareToNormal(normal, 26, 16).key, "cooler");
  assert.strictEqual(compareToNormal(null, 30, 20), null);
  assert.strictEqual(normalFor({ dates: dates.slice(0, 5), tmax, tmin, precip }, "2026-10-12"), null);
});

test("weather codes map to themes and keys", () => {
  assert.strictEqual(describeCode(0, true).condition, "sunny");
  assert.strictEqual(describeCode(0, false).condition, "night");
  assert.strictEqual(describeCode(95).key, "thunderstorm");
  assert.strictEqual(describeCode(45).icon, "fog");
  assert.strictEqual(describeCode(999).key, "thunderstorm");
});
