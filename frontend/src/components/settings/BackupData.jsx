import React from "react";

const BackupData = () => {
    return (
      <div className="flex gap-3">
        <button className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Backup Now
        </button>
        <button className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors">
          Restore
        </button>
      </div>
    );
  };
  
  export default BackupData;
  