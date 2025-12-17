const request = require("supertest");
const app = require("../src/app");

describe("Auth Endpoints", () => {
  it("should signup a new user", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "test@example.com",
      password: "password123",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("token");
  });
});
