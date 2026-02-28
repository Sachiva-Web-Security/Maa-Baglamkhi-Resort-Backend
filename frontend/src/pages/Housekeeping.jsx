import React, { useState } from 'react';
import { FaSearch, FaFilePdf, FaChevronUp, FaTimes, FaExclamationCircle } from 'react-icons/fa';
import HousekeepingRow from '../components/Housekeeping/HousekeepingRow';

const initialData = [
  {
    id: 1,
    selected: false,
    type: 'Accommodation',
    roomNo: '100',
    building: '',
    floor: '',
    section: '',
    guestStatus: '',
    roomType: 'Executive King Room',
    status: 'Vacant Dirty',
    assignee: 'No Housekeeper',
    layout: '',
    articles: '',
    services: '',
    notes: false,
  },
  {
    id: 2,
    selected: false,
    type: 'Accommodation',
    roomNo: '3',
    building: '',
    floor: '',
    section: '',
    guestStatus: '',
    roomType: 'King Room with seaview',
    status: 'Vacant Clean Inspected',
    assignee: 'No Housekeeper',
    layout: '',
    articles: '',
    services: '',
    notes: false,
  },
  {
    id: 3,
    selected: false,
    type: 'Accommodation',
    roomNo: '4',
    building: '',
    floor: '',
    section: '',
    guestStatus: 'Arrives today',
    roomType: 'Suite',
    status: 'Occupied Dirty',
    assignee: 'No Housekeeper',
    layout: '',
    articles: '',
    services: '',
    notes: true,
  },
  {
    id: 4,
    selected: false,
    type: 'Accommodation',
    roomNo: '5',
    building: '',
    floor: '',
    section: '',
    guestStatus: '',
    roomType: 'Executive King Room',
    status: 'Vacant Dirty',
    assignee: 'No Housekeeper',
    layout: '',
    articles: '',
    services: '',
    notes: false,
  },
  {
    id: 5,
    selected: false,
    type: 'Accommodation',
    roomNo: '6',
    building: '',
    floor: '',
    section: '',
    guestStatus: 'Arrives today',
    roomType: 'Standard Room',
    status: 'Occupied Clean',
    assignee: 'No Housekeeper',
    layout: '',
    articles: '',
    services: '',
    notes: true,
  },
  {
    id: 6,
    selected: false,
    type: 'Accommodation',
    roomNo: '7',
    building: '',
    floor: '',
    section: '',
    guestStatus: '',
    roomType: 'Standard Room',
    status: 'Vacant Dirty',
    assignee: 'No Housekeeper',
    layout: '',
    articles: '',
    services: '',
    notes: false,
  },
];

const allColumns = [
  { key: 'type', label: 'Type', required: true },
  { key: 'roomNo', label: 'Room No. / Name', required: true },
  { key: 'building', label: 'Building', required: false },
  { key: 'floor', label: 'Floor', required: false },
  { key: 'section', label: 'Section', required: false },
  { key: 'guestStatus', label: 'Guest Status', required: false },
  { key: 'roomType', label: 'Room Type', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'assignee', label: 'Assignee', required: false },
  { key: 'layout', label: 'Layout', required: false },
  { key: 'articles', label: 'Articles', required: false },
  { key: 'services', label: 'Services', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

function Housekeeping() {
  const [data, setData] = useState(initialData);
  const [selectAll, setSelectAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [housekeeperFilter, setHousekeeperFilter] = useState('All Housekeeper');
  const [roomTypeTab, setRoomTypeTab] = useState('Accommodation Rooms');
  const [showColumns, setShowColumns] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState(
    allColumns.map(col => col.key)
  );

  const selectedCount = data.filter(item => item.selected).length;

  const handleSelectChange = (id, checked) => {
    setData(prev =>
      prev.map(item => (item.id === id ? { ...item, selected: checked } : item))
    );
  };

  const handleSelectAll = checked => {
    setSelectAll(checked);
    setData(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleStatusChange = (id, status) => {
    setData(prev =>
      prev.map(item => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleAssigneeChange = (id, assignee) => {
    setData(prev =>
      prev.map(item => (item.id === id ? { ...item, assignee } : item))
    );
  };

  const toggleColumn = (columnKey) => {
    const column = allColumns.find(col => col.key === columnKey);
    if (column && column.required) return; // Don't allow hiding required columns
    
    setVisibleColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const filteredData = data.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.roomNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roomType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesHousekeeper = housekeeperFilter === 'All Housekeeper' || 
      item.assignee === housekeeperFilter;
    
    const matchesRoomType = roomTypeTab === 'Accommodation Rooms' || 
      roomTypeTab === 'Event Rooms';
    
    return matchesSearch && matchesHousekeeper && matchesRoomType;
  });

  return (
    <div className="min-h-screen bg-gray-100 pt-[100px] px-[30px] pb-[30px]">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Housekeeping</h1>
        <div className="text-sm text-gray-500">Home / Housekeeping</div>
      </div>

      {/* Top Control Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_260px_auto] gap-3 items-center">
          {/* Search Bar */}
          <div className="relative w-full">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white"
            />
          </div>

          {/* Housekeeper Filter */}
          <div className="w-full">
            <select
              value={housekeeperFilter}
              onChange={(e) => setHousekeeperFilter(e.target.value)}
              className="w-full px-4 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white"
            >
              <option>All Housekeeper</option>
              <option>John Doe</option>
              <option>Jane Smith</option>
            </select>
          </div>

          {/* Export PDF Button */}
          <div className="flex lg:justify-end">
            <button className="w-full lg:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
              <FaFilePdf />
              <span className="text-sm font-medium">Export PDF</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Selected: {selectedCount}</span>
            <button
              onClick={() => setShowColumns(!showColumns)}
              className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
            >
              <FaChevronUp className={showColumns ? '' : 'rotate-180'} />
              {showColumns ? 'Hide' : 'Show'} Columns
            </button>
          </div>

          {/* Room Type Tabs */}
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden w-full md:w-auto">
            <button
              onClick={() => setRoomTypeTab('Accommodation Rooms')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium transition-colors ${
                roomTypeTab === 'Accommodation Rooms'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Accommodation Rooms
            </button>
            <button
              onClick={() => setRoomTypeTab('Event Rooms')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                roomTypeTab === 'Event Rooms'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Event Rooms
            </button>
          </div>
        </div>
      </div>

      {/* Column Customization Bar */}
      {showColumns && (
        <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1 bg-teal-500 text-white rounded-full text-sm font-medium">
            Columns
          </div>
          {allColumns.map((column) => (
            <div
              key={column.key}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                visibleColumns.includes(column.key)
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {column.required && <span className="text-teal-500">*</span>}
              <span>{column.label}</span>
              {!column.required && (
                <button
                  onClick={() => toggleColumn(column.key)}
                  className="ml-1 hover:text-red-500"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-teal-50 text-gray-700 text-xs uppercase">
              <tr>
                {visibleColumns.includes('type') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="cursor-pointer"
                      />
                      Type
                    </div>
                  </th>
                )}
                {visibleColumns.includes('roomNo') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Room No. / Name</th>
                )}
                {visibleColumns.includes('building') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Building</th>
                )}
                {visibleColumns.includes('floor') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Floor</th>
                )}
                {visibleColumns.includes('section') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Section</th>
                )}
                {visibleColumns.includes('guestStatus') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Guest Status</th>
                )}
                {visibleColumns.includes('roomType') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Room Type</th>
                )}
                {visibleColumns.includes('status') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Status</th>
                )}
                {visibleColumns.includes('assignee') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Assignee</th>
                )}
                {visibleColumns.includes('layout') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Layout</th>
                )}
                {visibleColumns.includes('articles') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Articles</th>
                )}
                {visibleColumns.includes('services') && (
                  <th className="px-4 py-3 font-semibold border-r border-gray-200">Services</th>
                )}
                {visibleColumns.includes('notes') && (
                  <th className="px-4 py-3 font-semibold">Notes</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <HousekeepingRow
                  key={item.id}
                  item={item}
                  visibleColumns={visibleColumns}
                  onSelectChange={handleSelectChange}
                  onStatusChange={handleStatusChange}
                  onAssigneeChange={handleAssigneeChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Housekeeping;
