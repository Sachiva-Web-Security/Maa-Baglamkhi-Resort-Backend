module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  collectCoverageFrom: [
    "src/api.js",
    "src/utils/*.js",
    "src/services/*.js",
    "src/components/Hotel/bookingSession.js",
    "src/components/Hotel/bookingWizardApi.js",
    "src/pages/banquetUtils.js",
  ],
};
