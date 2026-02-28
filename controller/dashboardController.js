const db = require("../config/db");

exports.getMetrics = (req, res) => {
    const queries = {
        totalRooms: "SELECT COUNT(*) AS count FROM rooms",
        occupiedRooms: "SELECT COUNT(*) AS count FROM rooms WHERE status = 'Occupied'",
        todayRevenue: "SELECT COALESCE(SUM(amount), 0) AS total FROM accounts_transactions WHERE type = 'Income' AND DATE(date) = CURDATE()",
        todayCheckins: "SELECT COUNT(*) AS count FROM hotel_bookings WHERE DATE(check_in) = CURDATE()",
    };

    const results = {};
    let pending = Object.keys(queries).length;
    let hasError = false;

    Object.entries(queries).forEach(([key, query]) => {
        db.query(query, (err, rows) => {
            if (hasError) return;

            if (err) {
                console.error(`Error executing query: ${key}`, err);
                hasError = true;
                return res.status(500).json({ message: "Error fetching metrics" });
            }

            let val = rows[0].count !== undefined ? rows[0].count : rows[0].total;
            results[key] = val;

            pending--;
            if (pending === 0 && !hasError) {
                res.json(results);
            }
        });
    });
};

exports.getCharts = (req, res) => {
    // Return some static data for now to keep it simple, but this would normally
    // compute time-series data from db
    const data = {
        monthlyRevenue: [
            { name: "Jan", Online: 4000, Offline: 2400 },
            { name: "Feb", Online: 3000, Offline: 1398 },
            { name: "Mar", Online: 2000, Offline: 9800 },
            { name: "Apr", Online: 2780, Offline: 3908 },
            { name: "May", Online: 1890, Offline: 4800 },
            { name: "Jun", Online: 2390, Offline: 3800 },
            { name: "Jul", Online: 3490, Offline: 4300 },
        ],
        roomOccupancy: [
            { name: "Occupied", value: 85 },
            { name: "Available", value: 20 },
            { name: "Cleaning", value: 10 },
            { name: "Maintenance", value: 5 },
        ],
        foodSales: [
            { name: "Main Course", value: 45 },
            { name: "Starters", value: 25 },
            { name: "Beverages", value: 15 },
            { name: "Desserts", value: 15 },
        ]
    };

    // Real implementation would aggregate room statuses:
    db.query("SELECT status, COUNT(*) as count FROM rooms GROUP BY status", (err, rows) => {
        if (!err && rows && rows.length > 0) {
            data.roomOccupancy = rows.map(r => ({ name: r.status, value: r.count }));
        }
        res.json(data);
    });
};
