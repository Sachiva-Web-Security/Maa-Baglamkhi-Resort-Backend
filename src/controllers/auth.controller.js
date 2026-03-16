const pool = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { sendMail } = require('../config/mail');

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpExpiryDate(minutes = 10) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now;
}

async function register(req, res) {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      // check if user exists
      const [existingRows] = await conn.execute(
        'SELECT id, email_verified FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (existingRows.length > 0 && existingRows[0].email_verified === 1) {
        conn.release();
        return res.status(409).json({ message: 'Email is already registered' });
      }

      const passwordHash = await hashPassword(password);
      const otp = generateOtp();
      const otpExpiresAt = otpExpiryDate(10);

      let userId;

      if (existingRows.length === 0) {
        const [insertResult] = await conn.execute(
          `INSERT INTO users (name, email, password_hash, role, status, email_verified, otp_code, otp_expires_at)
           VALUES (?, ?, ?, 'student', 'active', 0, ?, ?)`,
          [name, email, passwordHash, otp, otpExpiresAt]
        );
        userId = insertResult.insertId;
      } else {
        userId = existingRows[0].id;
        await conn.execute(
          `UPDATE users
             SET name = ?, password_hash = ?, otp_code = ?, otp_expires_at = ?, email_verified = 0
           WHERE id = ?`,
          [name, passwordHash, otp, otpExpiresAt, userId]
        );
      }

      // send OTP email
      await sendMail({
        to: email,
        subject: 'Your OTP Code for College Admission Portal',
        html: `
          <p>Dear ${name},</p>
          <p>Your One-Time Password (OTP) for email verification is:</p>
          <h2>${otp}</h2>
          <p>This OTP is valid for 10 minutes. If you did not initiate this request, you can ignore this email.</p>
          <p>Regards,<br/>College Admission Portal</p>
        `
      });

      conn.release();

      return res.status(200).json({
        message: 'Registration initiated. OTP sent to your email for verification.'
      });
    } catch (innerErr) {
      conn.release();
      console.error('Error in register:', innerErr);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } catch (err) {
    console.error('DB connection error in register:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function verifyOtp(req, res) {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id, otp_code, otp_expires_at, email_verified FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (rows.length === 0) {
        conn.release();
        return res.status(404).json({ message: 'User not found' });
      }

      const user = rows[0];

      if (user.email_verified === 1) {
        conn.release();
        return res.status(400).json({ message: 'Email is already verified' });
      }

      if (!user.otp_code || !user.otp_expires_at) {
        conn.release();
        return res.status(400).json({ message: 'OTP not generated. Please register again.' });
      }

      const now = new Date();
      const expiresAt = new Date(user.otp_expires_at);

      if (otp !== user.otp_code) {
        conn.release();
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      if (now > expiresAt) {
        conn.release();
        return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
      }

      await conn.execute(
        `UPDATE users
           SET email_verified = 1,
               otp_code = NULL,
               otp_expires_at = NULL
         WHERE id = ?`,
        [user.id]
      );

      conn.release();

      return res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (innerErr) {
      conn.release();
      console.error('Error in verifyOtp:', innerErr);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } catch (err) {
    console.error('DB connection error in verifyOtp:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function resendOtp(req, res) {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id, name, email_verified FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (rows.length === 0) {
        conn.release();
        return res.status(404).json({ message: 'User not found' });
      }

      const user = rows[0];

      if (user.email_verified === 1) {
        conn.release();
        return res.status(400).json({ message: 'Email is already verified' });
      }

      const otp = generateOtp();
      const otpExpiresAt = otpExpiryDate(10);

      await conn.execute(
        'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
        [otp, otpExpiresAt, user.id]
      );

      await sendMail({
        to: email,
        subject: 'Your OTP Code for College Admission Portal',
        html: `
          <p>Dear ${user.name || 'User'},</p>
          <p>Your new One-Time Password (OTP) for email verification is:</p>
          <h2>${otp}</h2>
          <p>This OTP is valid for 10 minutes. If you did not initiate this request, you can ignore this email.</p>
          <p>Regards,<br/>College Admission Portal</p>
        `
      });

      conn.release();

      return res.status(200).json({ message: 'OTP resent successfully.' });
    } catch (innerErr) {
      conn.release();
      console.error('Error in resendOtp:', innerErr);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } catch (err) {
    console.error('DB connection error in resendOtp:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id, name, email, password_hash, role, status, email_verified FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (rows.length === 0) {
        conn.release();
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = rows[0];

      if (user.status !== 'active') {
        conn.release();
        return res.status(403).json({ message: 'Account is inactive. Contact support.' });
      }

      if (user.email_verified !== 1) {
        conn.release();
        return res.status(403).json({ message: 'Please verify your email using the OTP sent to you.' });
      }

      const passwordMatch = await comparePassword(password, user.password_hash);
      if (!passwordMatch) {
        conn.release();
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Update last_login
      await conn.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

      const token = signToken({
        id: user.id,
        role: user.role,
        email: user.email
      });

      conn.release();

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (innerErr) {
      conn.release();
      console.error('Error in login:', innerErr);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } catch (err) {
    console.error('DB connection error in login:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updatePassword(req, res) {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  try {
    const conn = await pool.getConnection();

    try {
      const [rows] = await conn.execute(
        'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (rows.length === 0) {
        conn.release();
        return res.status(404).json({ message: 'User not found' });
      }

      const user = rows[0];

      // Verify current password
      const passwordMatch = await comparePassword(currentPassword, user.password_hash);
      if (!passwordMatch) {
        conn.release();
        return res.status(401).json({ message: 'Incorrect current password' });
      }

      // Hash and update new password
      const newPasswordHash = await hashPassword(newPassword);
      await conn.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, userId]
      );

      conn.release();

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (innerErr) {
      conn.release();
      console.error('Error in updatePassword:', innerErr);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } catch (err) {
    console.error('DB connection error in updatePassword:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  updatePassword
};

