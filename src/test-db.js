const pool = require('./config/db');
(async () => {
    try {
        const [rows] = await pool.query('SELECT college_name, approved_by_admin FROM colleges');
        console.log("Colleges in DB:", rows);
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
