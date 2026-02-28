import React, { useState } from "react";

const Security = () => {
    const [password, setPassword] = useState("");

    const handleUpdate = () => {
      console.log("new password", password);
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
          <input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter new password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <button onClick={handleUpdate} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Update
        </button>
      </div>
    );
  };
  
  export default Security;

  