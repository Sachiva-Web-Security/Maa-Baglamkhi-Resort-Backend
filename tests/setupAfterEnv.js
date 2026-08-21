jest.setTimeout(120000);

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const shouldSuppressTestLog = (args) => {
  const message = args
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ");

  return (
    message.includes("inventoryRoutes loaded") ||
    message.includes("COMPANY DATA:")
  );
};

const shouldSuppressTestError = (args) => {
  const message = args
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ");

  return (
    message.includes("COMPANY ERROR:") ||
    message.includes("Company name is required") ||
    message.includes("Duplicate entry '101' for key 'room_number'")
  );
};

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation((...args) => {
    if (shouldSuppressTestLog(args)) {
      return;
    }
    originalConsoleLog(...args);
  });

  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (shouldSuppressTestError(args)) {
      return;
    }
    originalConsoleError(...args);
  });
});

afterAll(() => {
  console.log.mockRestore?.();
  console.error.mockRestore?.();
});
