const pool = require('../config/db');

// GET /api/college/profile
exports.getProfile = async (req, res) => {
    const userId = req.user.id; // From authMiddleware

    try {
        const [colleges] = await pool.query(
            'SELECT * FROM colleges WHERE user_id = ?',
            [userId]
        );

        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College profile not found' });
        }

        res.json(colleges[0]);
    } catch (error) {
        console.error('Error fetching college profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/college/profile
exports.updateProfile = async (req, res) => {
    const userId = req.user.id;
    const {
        description, location, courses,
        established_year, fees_starting, phone_number, whatsapp_number, address, website, facilities
    } = req.body;

    try {
        // Check if college profile exists
        const [colleges] = await pool.query('SELECT id FROM colleges WHERE user_id = ?', [userId]);
        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College profile not found' });
        }

        await pool.query(
            `UPDATE colleges SET 
                description = ?, location = ?, courses = ?,
                established_year = ?, fees_starting = ?, phone_number = ?, 
                whatsapp_number = ?, address = ?, website = ?, facilities = ?
            WHERE user_id = ?`,
            [
                description, location, courses,
                established_year, fees_starting, phone_number,
                whatsapp_number, address, website, facilities ? JSON.stringify(facilities) : null,
                userId
            ]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/college/brochure
exports.uploadBrochure = async (req, res) => {
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const brochureUrl = `/uploads/${req.file.filename}`;

    try {
        const [colleges] = await pool.query('SELECT id FROM colleges WHERE user_id = ?', [userId]);
        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College profile not found' });
        }

        await pool.query(
            'UPDATE colleges SET brochure_url = ? WHERE user_id = ?',
            [brochureUrl, userId]
        );

        res.json({ message: 'Brochure uploaded successfully', brochureUrl });
    } catch (error) {
        console.error('Error uploading brochure:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/college/logo
exports.uploadLogo = async (req, res) => {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const logoUrl = `/uploads/${req.file.filename}`;
    try {
        await pool.query('UPDATE colleges SET logo_url = ? WHERE user_id = ?', [logoUrl, userId]);
        res.json({ message: 'Logo uploaded successfully', logoUrl });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/college/cover
exports.uploadCoverPhoto = async (req, res) => {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const coverUrl = `/uploads/${req.file.filename}`;
    try {
        await pool.query('UPDATE colleges SET cover_photo_url = ? WHERE user_id = ?', [coverUrl, userId]);
        res.json({ message: 'Cover photo uploaded successfully', coverUrl });
    } catch (error) {
        console.error('Error uploading cover photo:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/college/applications
exports.getApplications = async (req, res) => {
    const userId = req.user.id;
    const { status } = req.query; // 'pending', 'approved', 'rejected'

    try {
        const [colleges] = await pool.query('SELECT id FROM colleges WHERE user_id = ?', [userId]);
        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College profile not found' });
        }
        const collegeId = colleges[0].id;

        let query = `
      SELECT a.*, u.name as student_name, u.email as student_email,
             sp.phone, sp.address, sp.qualification
      FROM applications a
      JOIN users u ON a.student_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE a.college_id = ?
    `;
        const params = [collegeId];

        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY a.created_at DESC';

        const [applications] = await pool.query(query, params);
        res.json(applications);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/college/application-status/:id
exports.updateApplicationStatus = async (req, res) => {
    const userId = req.user.id;
    const applicationId = req.params.id;
    const { status, remarks } = req.body; // 'pending', 'approved', 'rejected'

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    try {
        const [colleges] = await pool.query('SELECT id FROM colleges WHERE user_id = ?', [userId]);
        if (colleges.length === 0) {
            return res.status(404).json({ message: 'College profile not found' });
        }
        const collegeId = colleges[0].id;

        // Verify the application belongs to this college
        const [applications] = await pool.query(
            'SELECT id FROM applications WHERE id = ? AND college_id = ?',
            [applicationId, collegeId]
        );

        if (applications.length === 0) {
            return res.status(404).json({ message: 'Application not found or unauthorized' });
        }

        await pool.query(
            'UPDATE applications SET status = ?, remarks = ? WHERE id = ?',
            [status, remarks, applicationId]
        );

        res.json({ message: 'Application status updated successfully' });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
