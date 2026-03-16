const mysql = require('mysql2/promise');

async function migrateCollegesTable() {
    console.log("Starting standalone database migration for 'colleges' table...");

    // Create a standalone connection to bypass dotenv/IPv6 resolution issues
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '', // Assuming empty from .env
        database: 'college_admission'
    });

    const columnsToAdd = [
        "logo_url VARCHAR(255) DEFAULT NULL",
        "cover_photo_url VARCHAR(255) DEFAULT NULL",
        "established_year INT DEFAULT NULL",
        "fees_starting INT DEFAULT NULL",
        "rating DECIMAL(3,1) DEFAULT 0.0",
        "rating_count INT DEFAULT 0",
        "phone_number VARCHAR(50) DEFAULT NULL",
        "whatsapp_number VARCHAR(50) DEFAULT NULL",
        "address TEXT DEFAULT NULL",
        "website VARCHAR(255) DEFAULT NULL",
        "facilities TEXT DEFAULT NULL"
    ];

    for (let col of columnsToAdd) {
        try {
            const query = `ALTER TABLE colleges ADD COLUMN ${col};`;
            console.log(`Executing: ${query}`);
            await connection.query(query);
            console.log("Success.");
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log(`Column already exists. Skipping...`);
            } else {
                console.error(`Migration failed for ${col}:`, error.sqlMessage || error);
            }
        }
    }

    await connection.end();
    console.log("Migration complete!");
    process.exit();
}

migrateCollegesTable();
