const request = require("supertest");
const { app, createAuthToken } = require("./testDb");

const api = () => request(app);

const authHeader = (user) => ({
  Authorization: `Bearer ${createAuthToken(user)}`,
});

module.exports = {
  api,
  authHeader,
};
