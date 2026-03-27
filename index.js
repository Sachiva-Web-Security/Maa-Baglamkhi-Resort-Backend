const { server, initializeDatabase, shutdown } = require("./app");

const PORT = process.env.PORT || 5002;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

initializeDatabase();

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGUSR2", () => shutdown("SIGUSR2"));
