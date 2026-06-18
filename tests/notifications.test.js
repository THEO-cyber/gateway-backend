/**
 * Notification Tests — targets running server on localhost:PORT
 *
 * Covers:
 *   - GET /api/notifications/status (public)
 *   - POST /api/notifications/register-token
 *   - DELETE /api/notifications/unregister-token
 *   - Auth guard on register/unregister
 *   - Idempotent duplicate registration
 */
require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");

const BASE = `http://localhost:${process.env.PORT || 5090}`;

const TS = Date.now();
const TEST_EMAIL = `notif_${TS}@hndtest.local`;
const TEST_PASS = "TestPass1!";
let authToken = "";
let userId = "";

let User;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  }
  User = require("../src/models/User");

  const res = await request(BASE).post("/api/auth/register").send({
    email: TEST_EMAIL, password: TEST_PASS, firstName: "Notif", lastName: "Test",
  });
  if (!res.body.data) throw new Error(`Register failed: ${JSON.stringify(res.body)}`);
  authToken = res.body.data.token;
  userId = res.body.data.user.id;
}, 30000);

afterAll(async () => {
  if (User) await User.deleteMany({ email: { $regex: /hndtest\.local$/ } });
});

// ── Status endpoint (public) ──────────────────────────────────────────────────
describe("GET /api/notifications/status", () => {
  it("returns fcmEnabled status — no auth required", async () => {
    const res = await request(BASE).get("/api/notifications/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("fcmEnabled");
    expect(res.body.fcmEnabled).toBe(true); // Firebase configured
  });
});

// ── Register FCM token ────────────────────────────────────────────────────────
describe("POST /api/notifications/register-token", () => {
  it("registers an FCM device token", async () => {
    const res = await request(BASE)
      .post("/api/notifications/register-token")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ token: "FAKE_FCM_TOKEN_12345" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = await User.findById(userId).select("+fcmTokens");
    expect(user.fcmTokens).toContain("FAKE_FCM_TOKEN_12345");
  });

  it("is idempotent — does not duplicate the same token", async () => {
    await request(BASE)
      .post("/api/notifications/register-token")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ token: "FAKE_FCM_TOKEN_12345" });

    const user = await User.findById(userId).select("+fcmTokens");
    const count = user.fcmTokens.filter((t) => t === "FAKE_FCM_TOKEN_12345").length;
    expect(count).toBe(1);
  });

  it("rejects missing token", async () => {
    const res = await request(BASE)
      .post("/api/notifications/register-token")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("401 without auth", async () => {
    const res = await request(BASE)
      .post("/api/notifications/register-token")
      .send({ token: "abc" });
    expect(res.status).toBe(401);
  });
});

// ── Unregister FCM token ──────────────────────────────────────────────────────
describe("DELETE /api/notifications/unregister-token", () => {
  it("removes the FCM token from user", async () => {
    const res = await request(BASE)
      .delete("/api/notifications/unregister-token")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ token: "FAKE_FCM_TOKEN_12345" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = await User.findById(userId).select("+fcmTokens");
    expect(user.fcmTokens).not.toContain("FAKE_FCM_TOKEN_12345");
  });

  it("401 without auth", async () => {
    const res = await request(BASE)
      .delete("/api/notifications/unregister-token")
      .send({ token: "abc" });
    expect(res.status).toBe(401);
  });
});
