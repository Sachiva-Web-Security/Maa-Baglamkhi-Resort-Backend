import { useState } from 'react';
import './AttendanceForm.css';

const AttendanceForm = ({ onSubmit, onCancel, initialData = {} }) => {
  const [formData, setFormData] = useState({
    employeeName: initialData.employeeName || '',
    role: initialData.role || '',
    department: initialData.department || '',
    date: initialData.date || new Date().toISOString().split('T')[0],
    checkIn: initialData.checkIn || '',
    checkOut: initialData.checkOut || '',
    status: initialData.status || 'Present',
    method: initialData.method || 'Manual',
    notes: initialData.notes || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="attendance-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="employeeName">Employee Name *</label>
        <input
          type="text"
          id="employeeName"
          name="employeeName"
          value={formData.employeeName}
          onChange={handleChange}
          required
          placeholder="Enter employee name"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="role">Role *</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="">Select Role</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Staff">Staff</option>
            <option value="Receptionist">Receptionist</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="department">Department *</label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            required
          >
            <option value="">Select Department</option>
            <option value="Reception">Reception</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Management">Management</option>
            <option value="Security">Security</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status *</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            required
          >
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
            <option value="On Leave">On Leave</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="checkIn">Check-In Time</label>
          <input
            type="time"
            id="checkIn"
            name="checkIn"
            value={formData.checkIn}
            onChange={handleChange}
            placeholder="HH:MM"
          />
        </div>

        <div className="form-group">
          <label htmlFor="checkOut">Check-Out Time</label>
          <input
            type="time"
            id="checkOut"
            name="checkOut"
            value={formData.checkOut}
            onChange={handleChange}
            placeholder="HH:MM"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="method">Method *</label>
        <select
          id="method"
          name="method"
          value={formData.method}
          onChange={handleChange}
          required
        >
          <option value="Manual">Manual</option>
          <option value="Biometric">Biometric</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows="3"
          placeholder="Any additional notes..."
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-submit">
          Submit
        </button>
      </div>
    </form>
  );
};

export default AttendanceForm;

