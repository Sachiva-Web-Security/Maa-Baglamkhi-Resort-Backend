import React from "react";

const UsersRoles = () => {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Roles</h3>
        <ul className="list-disc list-inside space-y-2">
          <li className="text-gray-700">Admin</li>
          <li className="text-gray-700">Manager</li>
          <li className="text-gray-700">Receptionist</li>
          <li className="text-gray-700">Housekeeping</li>
        </ul>
      </div>
    );
  };
  
  export default UsersRoles;
  