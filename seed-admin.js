const pool = require('./src/config/db');
const { hashPassword } = require('./src/utils/password');

async function seedAdmin() {
    const adminEmail = 'admin@example.com';
    const adminPassword = 'adminpassword123';

    try {
        console.log('Generating password hash...');
        const hashedPassword = await hashPassword(adminPassword);

        console.log('Inserting admin user...');
        const [result] = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, status, email_verified)
       VALUES (?, ?, ?, 'admin', 'active', 1)`,
            ['Super Admin', adminEmail, hashedPassword]
        );

        console.log('✅ Admin user created successfully!');
        console.log('-----------------------------------');
        console.log('Admin Email:   ', adminEmail);
        console.log('Admin Password:', adminPassword);
        console.log('-----------------------------------');
        console.log('You can now use this to login via the /api/auth/login endpoint.');

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            console.log('⚠️ Admin user (admin@example.com) already exists in the database.');
        } else {
            console.error('❌ Error creating admin user:', err);
        }
    } finally {
        process.exit(0);
    }
}

seedAdmin();
