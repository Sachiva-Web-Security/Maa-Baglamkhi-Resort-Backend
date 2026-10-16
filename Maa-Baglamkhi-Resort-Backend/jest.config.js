module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
};
