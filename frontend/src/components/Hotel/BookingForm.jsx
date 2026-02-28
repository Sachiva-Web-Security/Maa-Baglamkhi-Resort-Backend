import { useState } from 'react';
import './BookingForm.css';

const BookingForm = ({ onSubmit, onCancel, initialData = {} }) => {
  const [formData, setFormData] = useState({
    guestName: initialData.guestName || '',
    room: initialData.room || '',
    checkIn: initialData.checkIn || '',
    checkOut: initialData.checkOut || '',
    phone: initialData.phone || '',
    email: initialData.email || '',
    guests: initialData.guests || '1',
    specialRequests: initialData.specialRequests || '',
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
    <form className="booking-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="guestName">Guest Name *</label>
        <input
          type="text"
          id="guestName"
          name="guestName"
          value={formData.guestName}
          onChange={handleChange}
          required
          placeholder="Enter guest name"
        />
      </div>

      <div className="form-group">
        <label htmlFor="room">Room Number *</label>
        <input
          type="text"
          id="room"
          name="room"
          value={formData.room}
          onChange={handleChange}
          required
          placeholder="Enter room number"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="checkIn">Check-In Date *</label>
          <input
            type="date"
            id="checkIn"
            name="checkIn"
            value={formData.checkIn}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="checkOut">Check-Out Date *</label>
          <input
            type="date"
            id="checkOut"
            name="checkOut"
            value={formData.checkOut}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Enter phone number"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="guests">Number of Guests</label>
        <input
          type="number"
          id="guests"
          name="guests"
          value={formData.guests}
          onChange={handleChange}
          min="1"
          placeholder="Enter number of guests"
        />
      </div>

      <div className="form-group">
        <label htmlFor="specialRequests">Special Requests</label>
        <textarea
          id="specialRequests"
          name="specialRequests"
          value={formData.specialRequests}
          onChange={handleChange}
          rows="3"
          placeholder="Any special requests..."
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

export default BookingForm;

