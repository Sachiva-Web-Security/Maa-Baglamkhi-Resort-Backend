import React from "react";

const menu = [
  { id: "hotel", label: "Hotel / Property Settings", icon: "🏨" },
  { id: "room", label: "Room Management", icon: "🛏️" },
  { id: "users", label: "User & Roles", icon: "👥" },
  { id: "pricing", label: "Pricing & Taxes", icon: "💲" },
  { id: "payment", label: "Payment Settings", icon: "💳" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "security", label: "Security", icon: "🔒" },
  { id: "backup", label: "Backup & Data", icon: "🗄️" },
];

const SettingsSidebar = ({ active, setActive }) => {
  return (
    <aside className="w-72 bg-white border-r pt-[70px] sticky top-[70px] h-[calc(100vh-70px)] overflow-auto shadow-sm">
      <h2 className="text-xl font-semibold p-5 border-b">⚙️ Settings</h2>
      <ul className="divide-y">
        {menu.map((item) => (
          <li
            key={item.id}
            onClick={() => setActive(item.id)}
            role="button"
            tabIndex={0}
            className={`flex items-center px-5 py-3 cursor-pointer gap-3 select-none transition-colors ${
              active === item.id
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default SettingsSidebar;
  