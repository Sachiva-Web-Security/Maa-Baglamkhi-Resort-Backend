const app = require('./app');

const PORT = process.env.PORT || 8080;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend server is running on port ${PORT}`);
});
