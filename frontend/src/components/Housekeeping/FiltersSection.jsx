import React from 'react';

function FiltersSection({ filters, onFilterChange }) {
  const selectStyle = {
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M19%209l-7%207-7-7%22%3E%3C/path%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1rem',
  };

  return (
    <div className="grid grid-cols-5 gap-3 mb-3">
      <select
        className="bg-gray-100 border-none rounded-md px-3 py-2 w-full text-gray-700 text-sm cursor-pointer pr-10 transition-colors hover:bg-gray-200 focus:outline-none focus:bg-gray-200"
        style={selectStyle}
        value={filters.room}
        onChange={e => onFilterChange('room', e.target.value)}
      >
        <option value="">Room</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="8">8</option>
        <option value="10">10</option>
        <option value="11">11</option>
        <option value="12">12</option>
      </select>
      <select
        className="bg-gray-100 border-none rounded-md px-3 py-2 w-full text-gray-700 text-sm cursor-pointer pr-10 transition-colors hover:bg-gray-200 focus:outline-none focus:bg-gray-200"
        style={selectStyle}
        value={filters.type}
        onChange={e => onFilterChange('type', e.target.value)}
      >
        <option value="">Room Type</option>
        <option value="Family room">Family room (Family)</option>
        <option value="Single room">Single room (Single)</option>
        <option value="Twin double room">Twin double room (Twin)</option>
        <option value="Hospitality Logge">Hospitality Logge (Suite)</option>
      </select>
      <select
        className="bg-gray-100 border-none rounded-md px-3 py-2 w-full text-gray-700 text-sm cursor-pointer pr-10 transition-colors hover:bg-gray-200 focus:outline-none focus:bg-gray-200"
        style={selectStyle}
        value={filters.status}
        onChange={e => onFilterChange('status', e.target.value)}
      >
        <option value="">Housekeeping Status</option>
        <option value="Clean">Clean</option>
        <option value="Dirty">Dirty</option>
        <option value="Cleaning">Cleaning</option>
        <option value="Out of service">Out of service</option>
      </select>
      <select
        className="bg-gray-100 border-none rounded-md px-3 py-2 w-full text-gray-700 text-sm cursor-pointer pr-10 transition-colors hover:bg-gray-200 focus:outline-none focus:bg-gray-200"
        style={selectStyle}
        value={filters.priority}
        onChange={e => onFilterChange('priority', e.target.value)}
      >
        <option value="">Priority</option>
        <option value="Low">Low</option>
        <option value="High">High</option>
      </select>
      <select
        className="bg-gray-100 border-none rounded-md px-3 py-2 w-full text-gray-700 text-sm cursor-pointer pr-10 transition-colors hover:bg-gray-200 focus:outline-none focus:bg-gray-200"
        style={selectStyle}
        value={filters.floor}
        onChange={e => onFilterChange('floor', e.target.value)}
      >
        <option value="">Floor</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
    </div>
  );
}

export default FiltersSection;