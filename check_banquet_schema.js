require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee',
});

db.connect((err) => {
    if (err) {
        console.log('DB CONNECTION ERROR:', err.message);
        process.exit(1);
    }
    console.log('Connected to DB:', process.env.DB_NAME || 'employee');

    // Step 1: Check if banquet_halls table exists
    db.query("SHOW TABLES LIKE 'banquet_halls'", (e, rows) => {
        if (e) {
            console.log('ERROR checking tables:', e.message);
            db.end(); process.exit(1);
        }

        if (rows.length === 0) {
            console.log('TABLE banquet_halls DOES NOT EXIST! Creating it...');
            const createSQL = `
        CREATE TABLE banquet_halls (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50),
          name VARCHAR(255) NOT NULL,
          capacity INT NOT NULL,
          rate_per_hour DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) DEFAULT 'Available',
          image VARCHAR(255) DEFAULT NULL,
          is_ac BOOLEAN DEFAULT TRUE
        )
      `;
            db.query(createSQL, (e2) => {
                if (e2) console.log('ERROR creating table:', e2.message);
                else console.log('TABLE banquet_halls CREATED!');
                testInsert();
            });
        } else {
            console.log('TABLE banquet_halls EXISTS');
            // Step 2: Check columns
            db.query('DESCRIBE banquet_halls', (e2, cols) => {
                if (e2) { console.log('DESCRIBE error:', e2.message); db.end(); process.exit(1); }
                const colNames = cols.map(c => c.Field);
                console.log('Columns:', colNames.join(', '));

                const toAdd = [];
                if (!colNames.includes('image')) toAdd.push("ADD COLUMN image VARCHAR(255) DEFAULT NULL");
                if (!colNames.includes('is_ac')) toAdd.push("ADD COLUMN is_ac BOOLEAN DEFAULT TRUE");

                if (toAdd.length > 0) {
                    console.log('Adding missing columns...');
                    db.query(`ALTER TABLE banquet_halls ${toAdd.join(', ')}`, (e3) => {
                        if (e3) console.log('ALTER error:', e3.message);
                        else console.log('COLUMNS ADDED!');
                        testInsert();
                    });
                } else {
                    console.log('All columns present!');
                    testInsert();
                }
            });
        }
    });

    function testInsert() {
        console.log('\nTesting INSERT...');
        db.query(
            "INSERT INTO banquet_halls (code, name, capacity, rate_per_hour, image, is_ac, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ['test_hall', 'Test Hall', 100, 5000, null, 1, 'Available'],
            (e, result) => {
                if (e) {
                    console.log('INSERT ERROR:', e.message);
                } else {
                    console.log('INSERT SUCCESS! ID:', result.insertId);
                    // Clean up test data
                    db.query("DELETE FROM banquet_halls WHERE code='test_hall'", () => {
                        console.log('Test data cleaned up');
                    });
                }
                db.end(() => {
                    console.log('\nDone!');
                    process.exit(0);
                });
            }
        );
    }
});
