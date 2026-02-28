const FiltersSection = ({
  date,
  department,
  role,
  searchQuery,
  onDateChange,
  onDepartmentChange,
  onRoleChange,
  onSearchChange,
  onAddManualEntry,
}) => {
  return (
    <div className="flex flex-wrap gap-3 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-xl">

      <input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="bg-black/30 border border-white/20 rounded-lg px-3 py-2"
      />

      <select
        value={department}
        onChange={(e) => onDepartmentChange(e.target.value)}
        className="bg-black/30 border border-white/20 rounded-lg px-3 py-2"
      >
        <option>All Departments</option>
        <option>Reception</option>
        <option>Kitchen</option>
      </select>

      <select
        value={role}
        onChange={(e) => onRoleChange(e.target.value)}
        className="bg-black/30 border border-white/20 rounded-lg px-3 py-2"
      >
        <option>All Roles</option>
        <option>Manager</option>
        <option>Staff</option>
      </select>

      <input
        type="text"
        placeholder="Search Employee"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-black/30 border border-white/20 rounded-lg px-3 py-2"
      />

      <button
        onClick={onAddManualEntry}
        className="ml-auto bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 rounded-lg font-medium shadow-lg"
      >
        + Add Manual Entry
      </button>
    </div>
  );
};

export default FiltersSection;