import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      <nav className="nav">
        <b>ProjectHub</b>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/projects">Projects</Link>
        {user.role === "admin" && <Link to="/users">Users</Link>}
        <Link to="/profile">Profile</Link>
        <span className="spacer"></span>
        <span>
          {user.name} ({user.role})
        </span>
        <button onClick={handleLogout}>Logout</button>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}