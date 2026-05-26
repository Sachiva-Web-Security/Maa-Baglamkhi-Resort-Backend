const http = require('http');
const db = require('./config/db');

const apiGet = (path) => new Promise((resolve, reject) => {
  const req = http.get({ hostname: 'localhost', port: 5002, path, headers: { Authorization: 'Bearer admin' } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c);
    res.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch { resolve({ raw: d.slice(0, 300) });
    });
  });
  req.on('error', reject);
});

const apiPost = (path, body) => new Promise((resolve, reject) => {
  const bodyStr = JSON.stringify(body);
  const opts = { hostname: 'localhost', port: 5002, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), Authorization: 'Bearer admin' } };
  const req = http.request(opts, (res) => {
    let d = '';
    res.on('data', (c) => (d += c);
    res.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch { resolve({ raw: d.slice(0, 300) });
    });
  });
  req.on('error', reject);
  req.write(bodyStr);
  req.end();
});

(async () => {
  // Create KOT with items
  const kot = await apiPost('/api/kitchen/order', {
    table: 'TEST99',
    waiter: 'TestWaiter',
    entityType: 'DINE_IN',
    items: [{ name: 'Cold Coffee', quantity: 2 }],
    prepTimeMinutes: 20,
  });
  console.log('KOT create response:', JSON.stringify(kot).slice(0, 200));

  // Fetch kitchen orders
  const orders = await apiGet('/api/kitchen/orders');
  const testKot = orders.find((o) => o.table_number === 'TEST99');
  if (testKot) {
    console.log('TEST99 KOT items field:', JSON.stringify(testKot.items));
    console.log('TEST99 KOT.items parsed:', typeof testKot.items);
  } else {
    console.log('TEST99 KOT not found in', orders.length, 'orders');
  }

  // Check DB raw
  db.query('SELECT items FROM kitchen_orders ORDER BY id DESC LIMIT 3', (e, rows) => {
    if (e) { console.error(e.message); db.end(); return; }
    rows.forEach((r, i) => {
      let parsed;
      try { parsed = JSON.parse(r.items); } catch { parsed = null; }
      console.log(`DB row ${i}: items =`, JSON.stringify(r.items), '-> parsed =', JSON.stringify(parsed));
    });
    db.end();
  });
})().catch(console.error);
