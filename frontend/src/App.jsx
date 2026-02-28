import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

import Sidebar from './components/Sidebar/Sidebar';
import Header from './components/Header/Header';

import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Hotel from './pages/Hotel';
import RestaurantPOS from './pages/RestaurantPOS';
import Accounts from './pages/Accounts';
import Housekeeping from './pages/Housekeeping';
import Banquet from './pages/Banquet';
import Reports from './pages/Reports';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import InventoryDashboard from './components/Inventory/InventoryDashboard';
import Setting from "./pages/Setting";
import Profile from "./pages/Profile";
import User from './pages/User';
import CreateUser from "./components/Createuser/CreateUser";
import Assignment from './pages/Assignments';
import Kitchen from './pages/Kitchen';



function Layout({ children, setIsAuthenticated }) {
  return (
    <div>

      {/* Header */}
      <Header setIsAuthenticated={setIsAuthenticated} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-[250px] mt-[70px] p-6">
        {children}
      </div>

    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(authStatus);
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>

      <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Dashboard: sabhi logged-in roles ke liye open */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Profile: sabhi logged-in users */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />


      {/* Attendance: admin + manager + staff + waiter + receptionist */}
      <Route
        path="/attendance"
        element={
          <ProtectedRoute
            allowedRoles={[
              "admin",
              "manager",
              "staff",
              "waiter",
              "receptionist",
            ]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Attendance />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Hotel: admin + manager + receptionist */}
      <Route
        path="/hotel"
        element={
          <ProtectedRoute allowedRoles={["admin", "manager", "receptionist"]}>
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Hotel />
            </Layout>
          </ProtectedRoute>
        }
      />



      {/* Restaurant POS: admin + manager + waiter + kitchen */}
      <Route
        path="/restaurant"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "manager", "waiter", "kitchen"]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <RestaurantPOS />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Accounts: admin + manager + accountant */}
      <Route
        path="/accounts"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "manager", "accountant"]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Accounts />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Inventory: admin + manager + kitchen */}
      <Route
        path="/inventory"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "manager", "kitchen"]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <InventoryDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* User management: sirf admin */}
      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <User />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Create user: sirf admin */}
      <Route
        path="/create-user"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <CreateUser />
            </Layout>
          </ProtectedRoute>
        }
      />
      {/* Assignment: admin + receptionist */}
<Route
  path="/assignments"
  element={
    <ProtectedRoute allowedRoles={["admin", "receptionist", "housekeeping"]}>
      <Layout setIsAuthenticated={setIsAuthenticated}>
        <Assignment />
      </Layout>
    </ProtectedRoute>
  }
/>
<Route
  path="/kitchen"
  element={
    <ProtectedRoute allowedRoles={["admin", "receptionist", "housekeeping"]}>
      <Layout setIsAuthenticated={setIsAuthenticated}>
        <Kitchen />
      </Layout>
    </ProtectedRoute>
  }
/>


      {/* Housekeeping: admin + housekeeping + manager */}
      <Route
        path="/housekeeping"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "housekeeping", "manager"]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Housekeeping />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Banquet: admin + manager + receptionist */}
      <Route
        path="/banquet"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "manager", "receptionist"]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Banquet />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Reports: admin + manager + accountant */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "manager", "accountant"]}
          >
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Settings: sirf admin */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Layout setIsAuthenticated={setIsAuthenticated}>
              <Setting />
            </Layout>
          </ProtectedRoute>
        }
      />  



      </Routes>
    </Router>
  );
}

export default App;
