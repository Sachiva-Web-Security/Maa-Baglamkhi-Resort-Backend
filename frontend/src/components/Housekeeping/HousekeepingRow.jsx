import React from 'react';
import { FaExclamationCircle } from 'react-icons/fa';

function HousekeepingRow({ item, visibleColumns, onSelectChange, onStatusChange, onAssigneeChange }) {
  const statusOptions = [
    'Vacant Dirty',
    'Vacant Clean Inspected',
    'Occupied Dirty',
    'Occupied Clean',
    'Out of Service',
  ];

  const assigneeOptions = [
    'No Housekeeper',
    'John Doe',
    'Jane Smith',
    'Mike Johnson',
  ];

  const getStatusTextClass = (status) => {
    if (status === 'Vacant Clean Inspected') return 'text-green-700';
    if (status === 'Occupied Clean') return 'text-green-700';
    if (status === 'Occupied Dirty') return 'text-orange-700';
    if (status === 'Vacant Dirty') return 'text-orange-700';
    if (status === 'Out of Service') return 'text-red-700';
    return 'text-gray-700';
  };

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      {visibleColumns.includes('type') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.selected || false}
              onChange={(e) => onSelectChange(item.id, e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-sm text-gray-700">{item.type}</span>
          </div>
        </td>
      )}
      
      {visibleColumns.includes('roomNo') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-700">{item.roomNo}</span>
        </td>
      )}
      
      {visibleColumns.includes('building') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-400">{item.building || '-'}</span>
        </td>
      )}
      
      {visibleColumns.includes('floor') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-400">{item.floor || '-'}</span>
        </td>
      )}
      
      {visibleColumns.includes('section') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-400">{item.section || '-'}</span>
        </td>
      )}
      
      {visibleColumns.includes('guestStatus') && (
        <td className="px-4 py-3 border-r border-gray-200">
          {item.guestStatus ? (
            <div className="flex items-center gap-1 text-sm text-orange-600">
              <FaExclamationCircle className="w-4 h-4" />
              <span>{item.guestStatus}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
      )}
      
      {visibleColumns.includes('roomType') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-700">{item.roomType}</span>
        </td>
      )}
      
      {visibleColumns.includes('status') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <select
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value)}
            className={`w-full min-w-[190px] px-3 py-2 border-2 border-teal-500 rounded-lg bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-200 ${getStatusTextClass(item.status)}`}
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </td>
      )}
      
      {visibleColumns.includes('assignee') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <select
            value={item.assignee}
            onChange={(e) => onAssigneeChange(item.id, e.target.value)}
            className="w-full min-w-[160px] px-3 py-2 border-2 border-teal-500 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
          >
            {assigneeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </td>
      )}
      
      {visibleColumns.includes('layout') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-400">{item.layout || '-'}</span>
        </td>
      )}
      
      {visibleColumns.includes('articles') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-400">{item.articles || '-'}</span>
        </td>
      )}
      
      {visibleColumns.includes('services') && (
        <td className="px-4 py-3 border-r border-gray-200">
          <span className="text-sm text-gray-400">{item.services || '-'}</span>
        </td>
      )}
      
      {visibleColumns.includes('notes') && (
        <td className="px-4 py-3">
          {item.notes ? (
            <button className="px-3 py-1 bg-teal-500 text-white text-sm rounded-md hover:bg-teal-600 transition-colors">
              Notes
            </button>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
      )}
    </tr>
  );
}

export default HousekeepingRow;
