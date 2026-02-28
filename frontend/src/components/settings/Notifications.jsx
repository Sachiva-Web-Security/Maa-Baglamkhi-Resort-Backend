import React, { useState } from "react";

const Notifications = () => {
    const [bookingSms, setBookingSms] = useState(true);

    return (
      <div className="space-y-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            checked={bookingSms}
            onChange={e => setBookingSms(e.target.checked)}
          />
          <span className="ml-3 text-sm font-medium text-gray-700">Booking Confirmation SMS</span>
        </label>
      </div>
    );
  };
  
  export default Notifications;
  