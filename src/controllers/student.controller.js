const pool = require('../config/db');

// GET /api/colleges
exports.getColleges = async (req, res) => {
    try {
        const [colleges] = await pool.query(
            `SELECT c.id, c.college_name, c.location, c.brochure_url,
                    c.logo_url, c.cover_photo_url, c.established_year, c.fees_starting, 
                    c.rating, c.rating_count, c.phone_number, c.whatsapp_number, 
                    c.address, c.website, c.facilities
       FROM colleges c
       WHERE c.approved_by_admin = 1
       ORDER BY c.created_at DESC`
        );
        res.json(colleges);
    } catch (error) {
        console.error('Error fetching colleges:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/colleges/:id
exports.getCollegeDetails = async (req, res) => {
    const collegeId = req.params.id;

    try {
        const [colleges] = await pool.query(
            `SELECT c.id, c.college_name, c.description, c.location, c.courses, c.brochure_url,
                    c.logo_url, c.cover_photo_url, c.established_year, c.fees_starting, 
                    c.rating, c.rating_count, c.phone_number, c.whatsapp_number, 
                    c.address, c.website, c.facilities,
              u.email as contact_email
       FROM colleges c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ? AND c.approved_by_admin = 1`,
            [collegeId]
        );

        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College not found' });
        }

        res.json(colleges[0]);
    } catch (error) {
        console.error('Error fetching college details:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/student/applications
exports.createApplication = async (req, res) => {
    const studentId = req.user.id;
    const { college_id } = req.body;

    if (!college_id) {
        return res.status(400).json({ message: 'college_id is required' });
    }

    try {
        // Check if college exists and is approved
        const [colleges] = await pool.query('SELECT id FROM colleges WHERE id = ? AND approved_by_admin = 1', [college_id]);
        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College not found' });
        }

        // Check if application already exists
        const [existing] = await pool.query(
            'SELECT id FROM applications WHERE student_id = ? AND college_id = ?',
            [studentId, college_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'You have already applied to this college' });
        }

        await pool.query(
            'INSERT INTO applications (student_id, college_id, status) VALUES (?, ?, ?)',
            [studentId, college_id, 'pending']
        );

        // Optionally create a notification for the college

        res.status(201).json({ message: 'Application submitted successfully' });
    } catch (error) {
        console.error('Error creating application:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/applications
exports.getMyApplications = async (req, res) => {
    const studentId = req.user.id;

    try {
        const [applications] = await pool.query(
            `SELECT a.id, a.status, a.remarks, a.created_at,
              c.college_name, c.location, c.brochure_url
       FROM applications a
       JOIN colleges c ON a.college_id = c.id
       WHERE a.student_id = ?
       ORDER BY a.created_at DESC`,
            [studentId]
        );

        res.json(applications);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/profile
exports.getProfile = async (req, res) => {
    const studentId = req.user.id;

    try {
        const [users] = await pool.query(
            `SELECT u.name, u.email, sp.phone, sp.address, sp.qualification
             FROM users u
             LEFT JOIN student_profiles sp ON u.id = sp.user_id
             WHERE u.id = ?`,
            [studentId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/student/profile
exports.updateProfile = async (req, res) => {
    const studentId = req.user.id;
    const { name, phone, address, qualification } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Update core user details
        if (name) {
            await connection.execute('UPDATE users SET name = ? WHERE id = ?', [name, studentId]);
        }

        // Upsert student profile
        if (phone !== undefined || address !== undefined || qualification !== undefined) {
            await connection.execute(
                `INSERT INTO student_profiles (user_id, phone, address, qualification)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE phone = VALUES(phone), address = VALUES(address), qualification = VALUES(qualification)`,
                [studentId, phone || null, address || null, qualification || null]
            );
        }

        await connection.commit();
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
};

// POST /api/enquiries
exports.submitEnquiry = async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Name, email, and message are required.' });
    }

    try {
        await pool.query(
            'INSERT INTO enquiries (name, email, message) VALUES (?, ?, ?)',
            [name, email, message]
        );
        res.status(201).json({ message: 'Inquiry submitted successfully. We will get back to you soon.' });
    } catch (error) {
        console.error('Error submitting inquiry:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
