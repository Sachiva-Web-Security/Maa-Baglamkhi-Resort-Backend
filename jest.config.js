module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  collectCoverageFrom: [
    "controller/**/*.js",
    "routes/**/*.js",
    "models/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
  setupFilesAfterEnv: ["<rootDir>/tests/setupAfterEnv.js"],
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
};
