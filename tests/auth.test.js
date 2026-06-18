/**
 * Auth Integration Tests — targets running server on localhost:5050
 * Covers: register, login, forgot-password (60-sec OTP), verify-otp,
 *         reset-password, email verification, Google OAuth guard,
 *         token refresh, ban/inactive blocks
 *
 * Run with server already started: npm run start:prod
 */
require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");

const BASE = `http://localhost:${process.env.PORT || 5050}`;
const api = (path) => `${BASE}${path}`;

const TS = Date.now();
const TEST_EMAIL = `authtest_${TS}@hndtest.local`;
const TEST_PASS = "TestPass1!";
let authToken = "";
let userId = "";

// We need direct DB access to inject tokens — connect through server's mongoose.
// Since this runs in the same machine where the server is running, we re-use the
// existing app connection by requiring the app module (it won't re-connect if already connected).
let User;
let crypto;
beforeAll(async () => {
  crypto = require("crypto");
  // Give server time if it just started
  await new Promise(r => setTimeout(r, 500));
  // Verify server is reachable
  const health = await request(BASE).get("/health").catch(() => null);
  if (!health || health.status >= 500) throw new Error("Server on port " + (process.env.PORT || 5050) + " is not reachable. Start it first with: npm run start:prod");

  // Connect mongoose so we can do direct DB ops (reuse same URI)
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  }
  User = require("../src/models/User");
}, 30000);

afterAll(async () => {
  if (User) await User.deleteMany({ email: { $regex: /hndtest\.local$/ } });
});

// ── Register ──────────────────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("rejects missing required fields", async () => {
    const res = await request(BASE).post("/api/auth/register").send({ email: TEST_EMAIL });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("registers a new user and returns token", async () => {
    const res = await request(BASE).post("/api/auth/register").send({
      email: TEST_EMAIL, password: TEST_PASS, firstName: "Auth", lastName: "Test",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.emailVerified).toBe(false);
    authToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  it("rejects duplicate email", async () => {
    const res = await request(BASE).post("/api/auth/register").send({
      email: TEST_EMAIL, password: TEST_PASS, firstName: "Dup", lastName: "User",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("rejects wrong password", async () => {
    const res = await request(BASE).post("/api/auth/login").send({ email: TEST_EMAIL, password: "WrongPass1!" });
    expect(res.status).toBe(401);
  });

  it("rejects non-existent email", async () => {
    const res = await request(BASE).post("/api/auth/login").send({ email: "nobody@hndtest.local", password: TEST_PASS });
    expect(res.status).toBe(401);
  });

  it("logs in and returns token + role", async () => {
    const res = await request(BASE).post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_PASS });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe("student");
    authToken = res.body.data.token;
  });

  it("student cannot use /login/admin", async () => {
    const res = await request(BASE).post("/api/auth/login/admin").send({ email: TEST_EMAIL, password: TEST_PASS });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/administrator/i);
  });
});

// ── Auth middleware ───────────────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  it("returns user with valid token", async () => {
    const res = await request(BASE).get("/api/auth/me").set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_EMAIL);
  });

  it("401 with no token", async () => {
    const res = await request(BASE).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("401 with garbage token", async () => {
    const res = await request(BASE).get("/api/auth/me").set("Authorization", "Bearer garbage.token.here");
    expect(res.status).toBe(401);
  });
});

// ── Token refresh ─────────────────────────────────────────────────────────────
describe("POST /api/auth/refresh", () => {
  it("returns a new distinct token", async () => {
    const res = await request(BASE).post("/api/auth/refresh").set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.token).not.toBe(authToken);
  });
});

// ── Email verification ────────────────────────────────────────────────────────
describe("Email Verification", () => {
  it("rejects invalid/expired token", async () => {
    const res = await request(BASE).get("/api/auth/verify-email/badfaketoken");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it("verifies email with a valid token (injected directly to DB)", async () => {
    const raw = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(raw).digest("hex");
    await User.findByIdAndUpdate(userId, {
      emailVerificationToken: hashed,
      emailVerificationExpire: Date.now() + 3600000,
      emailVerified: false,
    });

    const res = await request(BASE).get(`/api/auth/verify-email/${raw}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const u = await User.findById(userId);
    expect(u.emailVerified).toBe(true);
  });
});

// ── Forgot Password / OTP / Reset ─────────────────────────────────────────────
describe("Forgot Password → Verify OTP → Reset Password", () => {
  it("returns safe 200 for unknown email (no enumeration)", async () => {
    const res = await request(BASE).post("/api/auth/forgot-password").send({ email: "ghost@hndtest.local" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("OTP expires in 60 seconds (not longer)", async () => {
    await request(BASE).post("/api/auth/forgot-password").send({ email: TEST_EMAIL });
    const u = await User.findOne({ email: TEST_EMAIL }).select("+resetPasswordExpire");
    const secsLeft = (new Date(u.resetPasswordExpire).getTime() - Date.now()) / 1000;
    expect(secsLeft).toBeGreaterThan(50);   // at least 50 sec left
    expect(secsLeft).toBeLessThanOrEqual(60); // no more than 60 sec
  });

  it("full OTP flow: inject → verify → reset → login with new password", async () => {
    const knownOTP = "654321";
    const hashed = crypto.createHash("sha256").update(knownOTP).digest("hex");
    await User.findOneAndUpdate({ email: TEST_EMAIL }, {
      resetPasswordOTP: hashed,
      resetPasswordExpire: Date.now() + 600000,
      resetPasswordAttempts: 0,
      resetPasswordCooldown: undefined,
    });

    // Wrong OTP increments attempts counter
    const bad = await request(BASE).post("/api/auth/verify-otp").send({ email: TEST_EMAIL, otp: "000000" });
    expect(bad.status).toBe(400);
    expect(bad.body.attempts).toBe(1);

    // Correct OTP
    const good = await request(BASE).post("/api/auth/verify-otp").send({ email: TEST_EMAIL, otp: knownOTP });
    expect(good.status).toBe(200);

    // Reset password
    const reset = await request(BASE).post("/api/auth/reset-password").send({
      email: TEST_EMAIL, otp: knownOTP, newPassword: "NewPass1!",
    });
    expect(reset.status).toBe(200);
    expect(reset.body.data.token).toBeDefined();

    // New password works
    const login = await request(BASE).post("/api/auth/login").send({ email: TEST_EMAIL, password: "NewPass1!" });
    expect(login.status).toBe(200);
    authToken = login.body.data.token;
  });

  it("locks account after 3 wrong OTP attempts (30-min cooldown)", async () => {
    const otp = "777777";
    const hashed = crypto.createHash("sha256").update(otp).digest("hex");
    await User.findOneAndUpdate({ email: TEST_EMAIL }, {
      resetPasswordOTP: hashed, resetPasswordExpire: Date.now() + 600000,
      resetPasswordAttempts: 0, resetPasswordCooldown: undefined,
    });
    for (let i = 0; i < 3; i++) {
      await request(BASE).post("/api/auth/verify-otp").send({ email: TEST_EMAIL, otp: "111111" });
    }
    const res = await request(BASE).post("/api/auth/verify-otp").send({ email: TEST_EMAIL, otp: "111111" });
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/30 minutes/i);
    await User.findOneAndUpdate({ email: TEST_EMAIL }, { resetPasswordCooldown: undefined, resetPasswordAttempts: 0 });
  });
});

// ── Google OAuth guard ────────────────────────────────────────────────────────
describe("POST /api/auth/google", () => {
  it("rejects missing token", async () => {
    const res = await request(BASE).post("/api/auth/google").send({});
    expect(res.status).toBe(400);
  });

  it("rejects invalid Google token", async () => {
    const res = await request(BASE).post("/api/auth/google").send({ idToken: "invalid.google.token" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });
});

// ── Account status guards ─────────────────────────────────────────────────────
describe("Banned / deactivated account", () => {
  it("blocks banned user", async () => {
    await User.findByIdAndUpdate(userId, { isBanned: true });
    const res = await request(BASE).post("/api/auth/login").send({ email: TEST_EMAIL, password: "NewPass1!" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/banned/i);
    await User.findByIdAndUpdate(userId, { isBanned: false });
  });

  it("blocks inactive user", async () => {
    await User.findByIdAndUpdate(userId, { isActive: false });
    const res = await request(BASE).post("/api/auth/login").send({ email: TEST_EMAIL, password: "NewPass1!" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
    await User.findByIdAndUpdate(userId, { isActive: true });
  });
});
