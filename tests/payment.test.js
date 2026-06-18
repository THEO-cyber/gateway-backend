/**
 * Payment Integration Tests — targets running server on localhost:PORT
 *
 * Covers:
 *   - Legacy payment endpoint (410 Gone)
 *   - Paper download payment — Subscription pre-save sets endDate
 *   - Webhook success  → subscription active + user expiry set
 *   - Webhook failure  → subscription cancelled
 *   - Webhook cancel   → subscription cancelled
 *   - Duplicate webhook idempotency
 *   - Bad HMAC signature
 *   - Unknown transaction reference
 *   - Payment status check
 *   - Payment history (paginated)
 */
require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");

const BASE = `http://localhost:${process.env.PORT || 5090}`;

const TS = Date.now();
const TEST_EMAIL = `paytest_${TS}@hndtest.local`;
const TEST_PASS = "TestPass1!";
let authToken = "";
let userId = "";
let testTxId = "";
let testSubId = "";

const WEBHOOK_SECRET = process.env.NKWAPAY_WEBHOOK_SECRET || "nkwa_webhook_secret_key_here";
const sign = (payload) =>
  "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(JSON.stringify(payload)).digest("hex");

let User, Payment, Subscription;

beforeAll(async () => {
  // Connect mongoose to the same Atlas cluster (server must be running)
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  }
  User = require("../src/models/User");
  Payment = require("../src/models/Payment");
  Subscription = require("../src/models/Subscription");

  const regRes = await request(BASE).post("/api/auth/register").send({
    email: TEST_EMAIL, password: TEST_PASS, firstName: "Pay", lastName: "Test",
  });
  if (!regRes.body.data) throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);
  authToken = regRes.body.data.token;
  userId = regRes.body.data.user.id;
}, 30000);

afterAll(async () => {
  if (User) await User.deleteMany({ email: { $regex: /hndtest\.local$/ } });
  if (Payment) await Payment.deleteMany({ userEmail: { $regex: /hndtest\.local$/ } });
  if (Subscription && userId) {
    await Subscription.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  }
});

async function seedPendingPayment(txId, subId) {
  await Payment.create({
    transactionId: txId, amount: 500, phoneNumber: "237670000001",
    userId: new mongoose.Types.ObjectId(userId), userEmail: TEST_EMAIL,
    status: "pending", purpose: "subscription",
    metadata: { subscriptionId: subId.toString(), isSubscriptionPayment: true },
  });
}

// ── Legacy endpoint ───────────────────────────────────────────────────────────
describe("POST /api/payment/initiate (deprecated)", () => {
  it("returns 410 Gone", async () => {
    const res = await request(BASE)
      .post("/api/payment/initiate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "237670000001" });
    expect(res.status).toBe(410);
    expect(res.body.deprecated).toBe(true);
  });
});

// ── Fee endpoint ──────────────────────────────────────────────────────────────
describe("GET /api/payment/fee", () => {
  it("returns fee info", async () => {
    const res = await request(BASE).get("/api/payment/fee");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── Subscription pre-save: endDate for paper_download ─────────────────────────
describe("Subscription model — endDate auto-set for paper_download", () => {
  it("sets endDate ~9 months ahead when creating paper_download subscription", async () => {
    testTxId = `PAPER_TEST_${TS}`;
    const sub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500,
      transactionId: testTxId, status: "pending",
    });
    testSubId = sub._id.toString();
    await seedPendingPayment(testTxId, sub._id);

    expect(sub.endDate).toBeDefined();
    const months = (sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
    expect(months).toBeGreaterThan(8.5);
    expect(months).toBeLessThan(9.5);
    expect(sub.isActive).toBe(false); // still pending
  });
});

// ── Webhook: Success ──────────────────────────────────────────────────────────
describe("POST /api/payment/webhook — Success", () => {
  it("'completed' activates subscription and sets user expiry date", async () => {
    const payload = { reference: testTxId, status: "completed", transactionId: "NKWA_MOCK_001" };
    const res = await request(BASE)
      .post("/api/payment/webhook")
      .set("x-nkwa-signature", sign(payload))
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const payment = await Payment.findOne({ transactionId: testTxId });
    expect(payment.status).toBe("success");
    expect(payment.webhookReceived).toBe(true);

    const sub = await Subscription.findById(testSubId);
    expect(sub.status).toBe("active");

    const user = await User.findById(userId);
    expect(user.paperDownloadSubscriptionExpiryDate).toBeDefined();
    expect(new Date(user.paperDownloadSubscriptionExpiryDate).getTime()).toBeGreaterThan(Date.now());
  });

  it("duplicate webhook is idempotent — subscription stays active", async () => {
    const payload = { reference: testTxId, status: "completed" };
    const res = await request(BASE)
      .post("/api/payment/webhook")
      .set("x-nkwa-signature", sign(payload))
      .send(payload);
    expect(res.status).toBe(200);
    const sub = await Subscription.findById(testSubId);
    expect(sub.status).toBe("active");
  });
});

// ── Webhook: Failure ──────────────────────────────────────────────────────────
describe("POST /api/payment/webhook — Failure", () => {
  let failTxId, failSubId;

  beforeAll(async () => {
    failTxId = `PAPER_FAIL_${TS}`;
    const sub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500, transactionId: failTxId, status: "pending",
    });
    failSubId = sub._id.toString();
    await seedPendingPayment(failTxId, sub._id);
  });

  it("'failed' status cancels subscription", async () => {
    const payload = { reference: failTxId, status: "failed" };
    await request(BASE).post("/api/payment/webhook").set("x-nkwa-signature", sign(payload)).send(payload);

    const pmt = await Payment.findOne({ transactionId: failTxId });
    expect(pmt.status).toBe("failed");

    const sub = await Subscription.findById(failSubId);
    expect(sub.status).toBe("cancelled");
  });
});

// ── Webhook: Cancellation ─────────────────────────────────────────────────────
describe("POST /api/payment/webhook — Cancellation (user cancelled on phone)", () => {
  let cancelTxId, cancelSubId;

  beforeAll(async () => {
    cancelTxId = `PAPER_CANCEL_${TS}`;
    const sub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planType: "paper_download", amount: 500, transactionId: cancelTxId, status: "pending",
    });
    cancelSubId = sub._id.toString();
    await seedPendingPayment(cancelTxId, sub._id);
  });

  it("'cancelled' status marks payment failed and cancels subscription", async () => {
    const payload = { reference: cancelTxId, status: "cancelled" };
    await request(BASE).post("/api/payment/webhook").set("x-nkwa-signature", sign(payload)).send(payload);

    const pmt = await Payment.findOne({ transactionId: cancelTxId });
    expect(pmt.status).toBe("failed"); // 'cancelled' maps to FAILURE_STATUSES

    const sub = await Subscription.findById(cancelSubId);
    expect(sub.status).toBe("cancelled");
  });
});

// ── Webhook: Edge cases ───────────────────────────────────────────────────────
describe("POST /api/payment/webhook — Edge cases", () => {
  it("unknown reference → 200 with success=false (prevents NkwaPay retries)", async () => {
    const payload = { reference: "TX_NONEXISTENT_9999", status: "completed" };
    const res = await request(BASE)
      .post("/api/payment/webhook")
      .set("x-nkwa-signature", sign(payload))
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });

  it("bad HMAC → 200 with success=false", async () => {
    const payload = { reference: testTxId, status: "completed" };
    const res = await request(BASE)
      .post("/api/payment/webhook")
      .set("x-nkwa-signature", "sha256=deadbeef")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });

  it("missing reference → 200 with success=false", async () => {
    const payload = { status: "completed" };
    const res = await request(BASE)
      .post("/api/payment/webhook")
      .set("x-nkwa-signature", sign(payload))
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });
});

// ── Payment status endpoint ───────────────────────────────────────────────────
describe("GET /api/payment/status/:transactionId", () => {
  it("returns success for own completed payment", async () => {
    const res = await request(BASE)
      .get(`/api/payment/status/${testTxId}`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("success");
  });

  it("404 for non-existent transaction", async () => {
    const res = await request(BASE)
      .get("/api/payment/status/TX_NONE_9999")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it("401 without token", async () => {
    const res = await request(BASE).get(`/api/payment/status/${testTxId}`);
    expect(res.status).toBe(401);
  });
});

// ── Payment history ───────────────────────────────────────────────────────────
describe("GET /api/payment/history", () => {
  it("returns paginated history for authenticated user", async () => {
    const res = await request(BASE)
      .get("/api/payment/history")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.payments)).toBe(true);
    expect(res.body.data.payments.length).toBeGreaterThan(0);
  });

  it("401 without token", async () => {
    const res = await request(BASE).get("/api/payment/history");
    expect(res.status).toBe(401);
  });
});
