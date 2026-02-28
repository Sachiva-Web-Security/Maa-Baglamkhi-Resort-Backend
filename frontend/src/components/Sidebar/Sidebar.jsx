import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaBuilding,
  FaHome,
  FaUserCheck,
  FaHotel,
  FaUtensils,
  FaWallet,
  FaBoxes,
  FaBroom,
  FaGlassCheers,
  FaChartBar,
  FaCog,
  FaUser
} from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const userName = localStorage.getItem("name") || "User";
  const avatarUrl = localStorage.getItem("avatarUrl") || "";

  let roleMenus = [];

  if (role === "admin") {
    roleMenus = [
      { id: 2, name: 'Attendance', icon: FaUserCheck, path: '/attendance' },
      { id: 3, name: 'Hotel', icon: FaHotel, path: '/hotel' },
      { id: 4, name: 'Restaurant POS', icon: FaUtensils, path: '/restaurant' },
      { id: 5, name: 'Accounts', icon: FaWallet, path: '/accounts' },
      { id: 6, name: 'Inventory', icon: FaBoxes, path: '/inventory' },
      { id: 7, name: 'Housekeeping', icon: FaBroom, path: '/housekeeping' },
      { id: 8, name: 'Banquet', icon: FaGlassCheers, path: '/banquet' },
      { id: 9, name: 'Reports', icon: FaChartBar, path: '/reports' },
      { id: 10, name: 'Settings', icon: FaCog, path: '/settings' },
      { id: 11, name: 'User Management', icon: FaUserCheck, path: '/user' },
      { id: 12, name: 'Assignments', icon: FaUserCheck, path: '/assignments' },
      { id: 13, name: 'Kitchen', icon: FaUserCheck, path: '/kitchen' },
    ];
  } else if (role === "waiter") {
    roleMenus = [
      { id: 2, name: 'Attendance', icon: FaUserCheck, path: '/attendance' },
      { id: 3, name: 'Restaurant POS', icon: FaUtensils, path: '/restaurant' },
        { id: 3, name: 'Kitchen', icon: FaUtensils, path: '/kitchen' },
    ];
  } else if (role === "receptionist") {
    roleMenus = [
      { id: 2, name: 'Attendance', icon: FaUserCheck, path: '/attendance' },
      { id: 3, name: 'Hotel', icon: FaHotel, path: '/hotel' },
      { id: 4, name: 'Banquet', icon: FaGlassCheers, path: '/banquet' },
      { id: 5, name: 'Assignments', icon: FaUserCheck, path: '/assignments' },
    ];
  } else if (role === "housekeeping") {
  roleMenus = [
    { id: 2, name: 'Housekeeping', icon: FaBroom, path: '/housekeeping' },
    { id: 3, name: 'Assignments', icon: FaUserCheck, path: '/assignments' },
  ];
} else if (role === "accountant") {
    roleMenus = [
      { id: 2, name: 'Accounts', icon: FaWallet, path: '/accounts' },
      { id: 3, name: 'Reports', icon: FaChartBar, path: '/reports' },
    ];
  } else if (role === "kitchen") {
    roleMenus = [
      { id: 2, name: 'Restaurant POS', icon: FaUtensils, path: '/restaurant' },
      { id: 3, name: 'Inventory', icon: FaBoxes, path: '/inventory' },
    ];
  } else if (role === "manager" || role === "staff") {
    roleMenus = [
      { id: 2, name: 'Attendance', icon: FaUserCheck, path: '/attendance' },
      { id: 3, name: 'Hotel', icon: FaHotel, path: '/hotel' },
      { id: 4, name: 'Restaurant POS', icon: FaUtensils, path: '/restaurant' },
      { id: 5, name: 'Accounts', icon: FaWallet, path: '/accounts' },
      { id: 6, name: 'Inventory', icon: FaBoxes, path: '/inventory' },
      { id: 7, name: 'Housekeeping', icon: FaBroom, path: '/housekeeping' },
    ];
  }

  const menuItems = [
    { id: 1, name: 'Dashboard', icon: FaHome, path: '/dashboard' },
    { id: 99, name: 'My Profile', icon: FaUser, path: '/profile' },
    ...roleMenus,
  ];

  const handleNavClick = (path) => navigate(path);
  const isActive = (path) => location.pathname === path;

  return (
    <div
      className="
      fixed top-[70px] left-0
      w-[250px] h-[calc(100vh-70px)]
      flex flex-col justify-between
      text-white
      bg-gradient-to-b from-indigo-400 via-blue-400 to-purple-400
      shadow-2xl rounded-r-3xl
    "
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-6">
        <FaBuilding className="text-2xl" />
        <h2 className="text-xl font-bold">Hotel</h2>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              onClick={() => handleNavClick(item.path)}
              className={`
                flex items-center gap-3
                px-4 py-3 rounded-xl
                cursor-pointer transition-all duration-300
                ${
                  isActive(item.path)
                    ? 'bg-white/20 backdrop-blur-md shadow-lg'
                    : 'hover:bg-white/10'
                }
              `}
            >
              <Icon className="text-lg" />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="p-6 border-t border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              "👤"
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-xs opacity-70">
              {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Role"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;