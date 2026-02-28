import React, { useState } from "react";

const PricingTaxes = () => {
    const [gst, setGst] = useState("");
    const [serviceCharge, setServiceCharge] = useState("");

    const handleSave = () => {
      console.log({ gst, serviceCharge });
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">GST %</label>
          <input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter GST percentage"
            value={gst}
            onChange={e => setGst(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Service Charge %</label>
          <input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter service charge percentage"
            value={serviceCharge}
            onChange={e => setServiceCharge(e.target.value)}
          />
        </div>
  
        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Save
        </button>
      </div>
    );
  };
  
  export default PricingTaxes;
  