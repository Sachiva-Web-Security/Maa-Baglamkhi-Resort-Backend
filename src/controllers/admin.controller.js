const pool = require('../config/db');
const { hashPassword } = require('../utils/password');
const { sendMail } = require('../config/mail');
const crypto = require('crypto');

// Utility to generate a temporary password
const generateTempPassword = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

// POST /api/admin/create-college-account
exports.createCollegeAccount = async (req, res) => {
  const { name, email, college_name } = req.body;

  if (!name || !email || !college_name) {
    return res.status(400).json({ message: 'Name, email, and college_name are required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if user already exists
    const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Email already exists' });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    // Create User account for college
    const [userResult] = await connection.query(
      `INSERT INTO users (name, email, password_hash, role, status, email_verified)
       VALUES (?, ?, ?, 'college', 'active', 1)`,
      [name, email, hashedPassword]
    );

    const userId = userResult.insertId;

    // Create College profile
    await connection.query(
      `INSERT INTO colleges (user_id, college_name, approved_by_admin)
       VALUES (?, ?, 0)`,
      [userId, college_name]
    );

    await connection.commit();

    // Optionally send email with credentials
    const mailOptions = {
      to: email,
      subject: 'College Account Created',
      html: `<p>Hello ${name},</p>
             <p>Your college account has been created.</p>
             <p><strong>Login Email:</strong> ${email}<br/>
             <strong>Temporary Password:</strong> ${tempPassword}</p>
             <p>Please login and complete your profile, and be sure to update your password in the Security Settings tab.</p>`
    };
    sendMail(mailOptions).catch(err => console.error('Failed to send email:', err));

    res.status(201).json({
      message: 'College account created successfully',
      credentials: { email, password: tempPassword } // Include password in response just in case email fails in testing
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating college account:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};

// GET /api/admin/colleges
exports.getColleges = async (req, res) => {
  const { status } = req.query; // 'approved' or 'pending'

  try {
    let query = `
      SELECT c.*, u.name as contact_name, u.email as contact_email, u.status as user_status
      FROM colleges c
      JOIN users u ON c.user_id = u.id
    `;
    const params = [];

    if (status === 'approved') {
      query += ' WHERE c.approved_by_admin = 1';
    } else if (status === 'pending') {
      query += ' WHERE c.approved_by_admin = 0';
    }

    query += ' ORDER BY c.created_at DESC';

    const [colleges] = await pool.query(query, params);
    res.json(colleges);
  } catch (error) {
    console.error('Error fetching colleges:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/approve-college/:id
exports.approveCollege = async (req, res) => {
  const collegeId = req.params.id;

  try {
    const [result] = await pool.query(
      'UPDATE colleges SET approved_by_admin = 1 WHERE id = ?',
      [collegeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Optionally notify the college user...
    // const [college] = await pool.query('SELECT u.email FROM colleges c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [collegeId]);
    // sendMail(...)

    res.json({ message: 'College approved successfully' });
  } catch (error) {
    console.error('Error approving college:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/students
exports.getStudents = async (req, res) => {
  try {
    const [students] = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.email_verified, u.created_at,
              sp.phone, sp.address, sp.qualification
       FROM users u
       LEFT JOIN student_profiles sp ON u.id = sp.user_id
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`
    );
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/applications
exports.getApplications = async (req, res) => {
  try {
    const [applications] = await pool.query(
      `SELECT a.*,
              c.college_name,
              u.name as student_name, u.email as student_email
       FROM applications a
       JOIN colleges c ON a.college_id = c.id
       JOIN users u ON a.student_id = u.id
       ORDER BY a.created_at DESC`
    );
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/stats
exports.getSystemStats = async (req, res) => {
  try {
    const [userCounts] = await pool.query(
      `SELECT role, COUNT(*) as count FROM users GROUP BY role`
    );

    // Process raw rows into a mapped object: { student: X, college: Y, admin: Z }
    const roleStats = userCounts.reduce((acc, row) => {
      acc[row.role] = row.count;
      return acc;
    }, { student: 0, college: 0, admin: 0 });

    const totalUsers = roleStats.student + roleStats.college + roleStats.admin;

    res.json({
      total_users: totalUsers,
      breakdown: roleStats
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, name, email, role, status, email_verified, created_at, last_login
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/users/:id/ban
exports.banUser = async (req, res) => {
  try {
    await pool.query('UPDATE users SET status = "inactive" WHERE id = ?', [req.params.id]);
    res.json({ message: 'User banned successfully' });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/users/:id/unban
exports.unbanUser = async (req, res) => {
  try {
    await pool.query('UPDATE users SET status = "active" WHERE id = ?', [req.params.id]);
    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/enquiries
exports.getEnquiries = async (req, res) => {
  try {
    const [enquiries] = await pool.query(
      'SELECT * FROM enquiries ORDER BY created_at DESC'
    );
    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/applications/:id/status
exports.updateApplicationStatus = async (req, res) => {
  const applicationId = req.params.id;
  const { status, remarks } = req.body; // 'pending', 'approved', 'rejected'

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const [applications] = await pool.query(
      'SELECT id FROM applications WHERE id = ?',
      [applicationId]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    await pool.query(
      'UPDATE applications SET status = ?, remarks = ? WHERE id = ?',
      [status, remarks, applicationId]
    );

    res.json({ message: 'Application status updated successfully by Admin' });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// ADMIN COLLEGE PROFILE MANAGEMENT
// ==========================================

// GET /api/admin/college/:id
exports.getCollegeDetails = async (req, res) => {
  const collegeId = req.params.id;
  try {
    const [colleges] = await pool.query(
      `SELECT c.*, u.email as contact_email 
       FROM colleges c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [collegeId]
    );

    if (colleges.length === 0) {
      return res.status(404).json({ message: 'College not found' });
    }

    res.json(colleges[0]);
  } catch (error) {
    console.error('Error fetching admin college details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/college/:id
exports.updateCollegeDetails = async (req, res) => {
  const collegeId = req.params.id;
  const {
    description, location, courses, college_name,
    established_year, fees_starting, phone_number, whatsapp_number, address, website, facilities
  } = req.body;

  try {
    const [colleges] = await pool.query('SELECT id FROM colleges WHERE id = ?', [collegeId]);
    if (colleges.length === 0) {
      return res.status(404).json({ message: 'College profile not found' });
    }

    await pool.query(
      `UPDATE colleges SET 
              college_name = ?, description = ?, location = ?, courses = ?,
              established_year = ?, fees_starting = ?, phone_number = ?, 
              whatsapp_number = ?, address = ?, website = ?, facilities = ?
          WHERE id = ?`,
      [
        college_name, description, location, courses,
        established_year, fees_starting, phone_number,
        whatsapp_number, address, website, facilities ? JSON.stringify(facilities) : null,
        collegeId
      ]
    );

    res.json({ message: 'College profile updated successfully by Admin' });
  } catch (error) {
    console.error('Error updating college profile via Admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/college/:id/logo
exports.uploadCollegeLogo = async (req, res) => {
  const collegeId = req.params.id;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const logoUrl = `/uploads/${req.file.filename}`;
  try {
    await pool.query('UPDATE colleges SET logo_url = ? WHERE id = ?', [logoUrl, collegeId]);
    res.json({ message: 'Logo uploaded successfully by Admin', logoUrl });
  } catch (error) {
    console.error('Error uploading logo via Admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/college/:id/cover
exports.uploadCollegeCover = async (req, res) => {
  const collegeId = req.params.id;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const coverUrl = `/uploads/${req.file.filename}`;
  try {
    await pool.query('UPDATE colleges SET cover_photo_url = ? WHERE id = ?', [coverUrl, collegeId]);
    res.json({ message: 'Cover photo uploaded successfully by Admin', coverUrl });
  } catch (error) {
    console.error('Error uploading cover photo via Admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/college/:id/brochure
exports.uploadCollegeBrochure = async (req, res) => {
  const collegeId = req.params.id;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const brochureUrl = `/uploads/${req.file.filename}`;
  try {
    await pool.query('UPDATE colleges SET brochure_url = ? WHERE id = ?', [brochureUrl, collegeId]);
    res.json({ message: 'Brochure uploaded successfully by Admin', brochureUrl });
  } catch (error) {
    console.error('Error uploading brochure via Admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
