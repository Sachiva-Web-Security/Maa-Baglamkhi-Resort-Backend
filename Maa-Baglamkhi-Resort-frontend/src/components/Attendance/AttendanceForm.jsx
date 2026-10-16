import { useState } from "react";

/* Premium input styles
   Mobile-first sizing, scaling up through tablet/iPad, landing on the
   EXACT original values at xl (≥1280px = Desktop) */
const fieldCls = `
w-full
h-[48px]
md:h-[52px]
xl:h-[56px]

rounded-[16px]
md:rounded-[18px]
xl:rounded-[20px]

border
border-slate-200/80

bg-white

px-4
py-2.5
md:px-5
md:py-3

text-[15px]
md:text-[16px]
xl:text-[17px]
font-medium
text-slate-900

shadow-[0_2px_12px_rgba(37,99,235,0.05)]

outline-none

transition-all
duration-300

placeholder:text-slate-400

focus:border-blue-500
focus:ring-[6px]
focus:ring-blue-100/80
focus:shadow-[0_4px_20px_rgba(37,99,235,0.10)]

hover:border-blue-300
hover:shadow-[0_4px_16px_rgba(37,99,235,0.08)]
`;

const labelCls = `
mb-2
md:mb-2.5
block
text-[13px]
md:text-[13.5px]
xl:text-[14px]
font-bold
uppercase
tracking-[0.08em]
xl:tracking-[0.12em]
text-slate-600
`;



const AttendanceForm = ({ onSubmit, onCancel, initialData = {} }) => {
  const [formData, setFormData] = useState({
    employeeName: initialData.employeeName || "",
    role: initialData.role || "",
    department: initialData.department || "",
    date: initialData.date || new Date().toISOString().split("T")[0],
    checkIn: initialData.checkIn || "",
    checkOut: initialData.checkOut || "",
    status: initialData.status || "Present",
    method: initialData.method || "Manual",
    notes: initialData.notes || "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5 min-w-0">
      {/* Employee Name */}
      <div>
        <label htmlFor="employeeName" className={labelCls}>
          Employee Name
        </label>
        <input
          type="text"
          id="employeeName"
          name="employeeName"
          value={formData.employeeName}
          onChange={handleChange}
          required
          placeholder="Enter employee name"
          className={fieldCls}
        />
      </div>

      {/* Role + Department */}
      <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
        <div>
          <label htmlFor="role" className={labelCls}>
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className={fieldCls}
          >
            <option value="">Select Role</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Staff">Staff</option>
            <option value="Receptionist">Receptionist</option>
            <option value="Housekeeping">Housekeeping</option>
          </select>
        </div>

        <div>
          <label htmlFor="department" className={labelCls}>
            Department
          </label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            required
            className={fieldCls}
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

      {/* Date + Status */}
      <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
        <div>
          <label htmlFor="date" className={labelCls}>
            Date
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className={fieldCls}
          />
        </div>

        <div>
          <label htmlFor="status" className={labelCls}>
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            required
            className={fieldCls}
          >
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
            <option value="On Leave">On Leave</option>
          </select>
        </div>
      </div>

      {/* Check-In + Check-Out */}
      <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
        <div>
          <label htmlFor="checkIn" className={labelCls}>
            Check-In Time
          </label>
          <input
            type="time"
            id="checkIn"
            name="checkIn"
            value={formData.checkIn}
            onChange={handleChange}
            className={fieldCls}
          />
        </div>

        <div>
          <label htmlFor="checkOut" className={labelCls}>
            Check-Out Time
          </label>
          <input
            type="time"
            id="checkOut"
            name="checkOut"
            value={formData.checkOut}
            onChange={handleChange}
            className={fieldCls}
          />
        </div>
      </div>

      {/* Method */}
      <div>
        <label htmlFor="method" className={labelCls}>
          Method
        </label>
        <select
          id="method"
          name="method"
          value={formData.method}
          onChange={handleChange}
          required
          className={fieldCls}
        >
          <option value="Manual">Manual</option>
          <option value="Biometric">Biometric</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className={labelCls}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows="3"
          placeholder="Any additional notes..."
          className={`
            ${fieldCls}
            h-auto
            py-2.5
            md:py-3
            resize-none
          `}
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="
          w-full
          sm:w-auto

          rounded-[16px]
          md:rounded-[18px]
          xl:rounded-[20px]

          border
          border-slate-200
          bg-white
          px-6
          md:px-7

          h-[48px]
          md:h-[52px]
          xl:h-[56px]

          text-[14px]
          md:text-[15.5px]
          xl:text-[17px]
          font-bold
          text-slate-700

          transition-all
          duration-300

          hover:border-blue-300
          hover:text-blue-700
          hover:shadow-[0_4px_16px_rgba(37,99,235,0.08)]
        "
        >
          Cancel
        </button>
        <button
          type="submit"
          className="
          w-full
          sm:w-auto

          rounded-[16px]
          md:rounded-[18px]
          xl:rounded-[20px]

          bg-gradient-to-r
          from-blue-600
          via-blue-500
          to-sky-500

          px-6
          md:px-8

          h-[48px]
          md:h-[52px]
          xl:h-[56px]

          text-[14px]
          md:text-[15.5px]
          xl:text-[17px]
          font-bold
          text-white

          shadow-[0_10px_28px_rgba(37,99,235,0.24)]
          xl:shadow-[0_16px_40px_rgba(37,99,235,0.28)]

          transition-all
          duration-300

          hover:-translate-y-0.5
          hover:shadow-[0_22px_50px_rgba(37,99,235,0.38)]
        "
        >
          Submit
        </button>
      </div>
    </form>
  );
};

export default AttendanceForm;