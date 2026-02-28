import React from "react";

const RoomManagement = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Room Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Max Guests</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Base Price</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-700">Standard</td>
              <td className="px-4 py-3 text-sm text-gray-700">2</td>
              <td className="px-4 py-3 text-sm text-gray-700">₹2500</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };
  
  export default RoomManagement;
  