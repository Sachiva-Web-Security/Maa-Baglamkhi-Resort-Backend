import React, { useState } from "react";

const PaymentSettings = () => {
    const options = ["Cash", "Card", "UPI", "Bank Transfer"];
    const [enabled, setEnabled] = useState(
      options.reduce((acc, p) => ({ ...acc, [p]: false }), {})
    );

    const toggle = key => {
      setEnabled(e => ({ ...e, [key]: !e[key] }));
    };

    return (
      <div className="space-y-3">
        {options.map(p => (
          <label key={p} className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              checked={enabled[p]}
              onChange={() => toggle(p)}
            />
            <span className="ml-3 text-sm font-medium text-gray-700">{p}</span>
          </label>
        ))}
      </div>
    );
  };
  
  export default PaymentSettings;
  