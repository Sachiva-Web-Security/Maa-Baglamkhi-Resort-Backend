import { useNavigate } from "react-router-dom";

const Header = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "User";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    localStorage.removeItem("isAuthenticated");

    if (setIsAuthenticated) {
      setIsAuthenticated(false);
    }

    navigate("/login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[70px] 
    bg-gradient-to-r from-rose-400 via-pink-400 to-fuchsia-400 
    shadow-md flex items-center justify-between px-6 z-50 text-white">

      <h1 className="text-lg font-semibold">
        Maa Baglamukhi Resort
      </h1>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          Welcome, {userName}
        </span>

        <button
          onClick={handleLogout}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-1 rounded-md text-sm backdrop-blur-md"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;