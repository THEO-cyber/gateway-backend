/**
 * Subscription Integration Tests — targets running server on localhost:PORT
 *
 * Covers:
 *   - GET /api/subscriptions/plans
 *   - POST /api/subscriptions/subscribe — validation
 *   - GET /api/subscriptions/my-subscriptions
 *   - GET /api/subscriptions/check-access
 *   - PUT /api/subscriptions/:id/cancel
 *   - Pre-save endDate auto-calculation (~9 months for paper_download)
 *   - Active subscription grants access
 *   - isActive virtual
 *   - expireOldSubscriptions() static method
 *   - hasActivePlan() static method
 *   - renew() instance method
 */
require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");

const BASE = `http://localhost:${process.env.PORT || 5090}`;

const TS = Date.now();
const TEST_EMAIL = `subtest_${TS}@hndtest.local`;
const TEST_PASS = "TestPass1!";
let authToken = "";
let userId = "";

let User, Subscription;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  }
  User = require("../src/models/User");
  Subscription = require("../src/models/Subscription");

  const res = await request(BASE).post("/api/auth/register").send({
    email: TEST_EMAIL, password: TEST_PASS, firstName: "Sub", lastName: "Test",
  });
  if (!res.body.data) throw new Error(`Register failed: ${JSON.stringify(res.body)}`);
  authToken = res.body.data.token;
  userId = res.body.data.user.id;
}, 30000);

afterAll(async () => {
  if (User) await User.deleteMany({ email: { $regex: /hndtest\.local$/ } });
  if (Subscription && userId) {
    await Subscription.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  }
});

// ── Plans endpoint ────────────────────────────────────────────────────────────
describe("GET /api/subscriptions/plans", () => {
  it("returns paper_download plan (requires auth)", async () => {
    const res = await request(BASE)
      .get("/api/subscriptions/plans")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.plans.paper_download).toBeDefined();
    expect(res.body.plans.paper_download.price).toBe(500);
  });

  it("401 without auth", async () => {
    const res = await request(BASE).get("/api/subscriptions/plans");
    expect(res.status).toBe(401);
  });
});

// ── My subscriptions ──────────────────────────────────────────────────────────
describe("GET /api/subscriptions/my-subscriptions", () => {
  it("returns empty list for new user", async () => {
    const res = await request(BASE)
      .get("/api/subscriptions/my-subscriptions")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.subscriptions.count.total).toBe(0);
  });

  it("401 without auth", async () => {
    const res = await request(BASE).get("/api/subscriptions/my-subscriptions");
    expect(res.status).toBe(401);
  });
});

// ── Subscribe validation ──────────────────────────────────────────────────────
describe("POST /api/subscriptions/subscribe — validation", () => {
  it("rejects invalid plan type", async () => {
    const res = await request(BASE)
      .post("/api/subscriptions/subscribe")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ planType: "fake_plan", phoneNumber: "237670000001" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|available/i);
  });

  it("rejects missing phone number", async () => {
    const res = await request(BASE)
      .post("/api/subscriptions/subscribe")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ planType: "paper_download" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/phone/i);
  });

  it("rejects wrong amount", async () => {
    const res = await request(BASE)
      .post("/api/subscriptions/subscribe")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ planType: "paper_download", phoneNumber: "237670000001", amount: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/amount|invalid/i);
  });
});

// ── Check access: no subscription ─────────────────────────────────────────────
describe("GET /api/subscriptions/check-access — no subscription", () => {
  it("denies access when no active subscription exists", async () => {
    const res = await request(BASE)
      .get("/api/subscriptions/check-access?service=courses")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(false);
  });
});

// ── Pre-save endDate for paper_download ───────────────────────────────────────
describe("Subscription model — endDate pre-save for paper_download", () => {
  let sub;

  beforeAll(async () => {
    sub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: `SUB_PRESAVE_${TS}`, status: "pending",
    });
  });

  it("sets endDate ~9 months ahead", () => {
    expect(sub.endDate).toBeDefined();
    const months = (sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
    expect(months).toBeGreaterThan(8.5);
    expect(months).toBeLessThan(9.5);
  });

  it("isActive virtual is false for pending subscription", () => {
    expect(sub.isActive).toBe(false); // status is 'pending', not 'active'
  });
});

// ── Active subscription ───────────────────────────────────────────────────────
describe("Active subscription grants access", () => {
  let activeSub;

  beforeAll(async () => {
    activeSub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: `SUB_ACTIVE_${TS}`, status: "active",
    });
    const user = await User.findById(userId);
    await user.updateSubscriptionStatus();
  });

  it("isActive virtual is true", () => {
    expect(activeSub.isActive).toBe(true);
  });

  it("hasActivePlan() returns true", async () => {
    const has = await Subscription.hasActivePlan(userId, "paper_download");
    expect(has).toBe(true);
  });

  it("my-subscriptions shows at least 1 active", async () => {
    const res = await request(BASE)
      .get("/api/subscriptions/my-subscriptions")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.subscriptions.count.active).toBeGreaterThanOrEqual(1);
  });

  it("duplicate active subscription is rejected (409 Conflict)", async () => {
    const res = await request(BASE)
      .post("/api/subscriptions/subscribe")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ planType: "paper_download", phoneNumber: "237670000001" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already have/i);
  });
});

// ── Expired subscription ──────────────────────────────────────────────────────
describe("Expired subscription logic", () => {
  let expiredSub;

  beforeAll(async () => {
    expiredSub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: `SUB_EXPIRED_${TS}`,
      status: "active",
      endDate: new Date(Date.now() - 1000), // already past
    });
  });

  it("isActive virtual is false when endDate is in the past", () => {
    expect(expiredSub.status).toBe("active");
    expect(expiredSub.isActive).toBe(false);
  });

  it("expireOldSubscriptions() marks it 'expired' in DB", async () => {
    await Subscription.expireOldSubscriptions();
    const refreshed = await Subscription.findById(expiredSub._id);
    expect(refreshed.status).toBe("expired");
  });
});

// ── Cancel subscription ───────────────────────────────────────────────────────
describe("PUT /api/subscriptions/:id/cancel", () => {
  let subToCancel;

  beforeAll(async () => {
    subToCancel = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: `SUB_CANCEL_${TS}`, status: "active",
    });
  });

  it("cancels an active subscription", async () => {
    const res = await request(BASE)
      .put(`/api/subscriptions/${subToCancel._id}/cancel`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const refreshed = await Subscription.findById(subToCancel._id);
    expect(refreshed.status).toBe("cancelled");
  });

  it("cannot cancel an already-cancelled subscription (400)", async () => {
    const res = await request(BASE)
      .put(`/api/subscriptions/${subToCancel._id}/cancel`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already cancelled/i);
  });

  it("cannot cancel another user's subscription (404)", async () => {
    const otherReg = await request(BASE).post("/api/auth/register").send({
      email: `other_${TS}@hndtest.local`, password: TEST_PASS, firstName: "X", lastName: "Y",
    });
    const otherToken = otherReg.body.data.token;

    const mySub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: `SUB_MINE_${TS}`, status: "active",
    });

    const res = await request(BASE)
      .put(`/api/subscriptions/${mySub._id}/cancel`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});

// ── renew() instance method ───────────────────────────────────────────────────
describe("Subscription.renew()", () => {
  it("extends endDate by the given number of months", async () => {
    const sub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: `SUB_RENEW_${TS}`, status: "active",
    });
    const before = sub.endDate.getTime();
    await sub.renew(3);
    const after = (await Subscription.findById(sub._id)).endDate.getTime();
    expect(after).toBeGreaterThan(before);
    const diffMonths = (after - before) / (1000 * 60 * 60 * 24 * 30);
    expect(diffMonths).toBeGreaterThan(2.9);
    expect(diffMonths).toBeLessThan(3.1);
  });
});
