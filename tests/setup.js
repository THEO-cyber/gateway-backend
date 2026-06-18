/**
 * Shared test setup.
 * Load env first — individual test files then connect mongoose and hit the server.
 *
 * IMPORTANT: The server must already be running (npm start) before running tests.
 * Tests use supertest against http://localhost:PORT (default 5090).
 * Direct model ops use mongoose connected to the same Atlas URI.
 */
require("dotenv").config();
process.env.NODE_ENV = "test";
