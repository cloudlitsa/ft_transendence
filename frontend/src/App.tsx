import { Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignupPage from "./pages/SignupPage.tsx";
import FriendsPage from "./pages/FriendsPage.tsx";
import OfflineBanner from "./components/OfflineBanner.tsx";
import { useAuth } from "./lib/AuthContext.tsx";
import RequireAuth from "./components/RequireAuth.tsx";

// App is now the router for the whole app. It decides what page to render based on the URL path.
// Routes is a container for all the Route components. Each Route component defines a path and the component to render when the path matches the URL.
export default function App() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  async function  handleLogout(){
    await logout();
    navigate("/login");
  }
  if (loading)
    return <p>Loading ...</p>
  return (
    // Fragment (<>...</>) lets us return the full-width banner alongside the
    // centered content without adding an extra wrapping element.
    <>
      {/* Full-width bar at the very top; renders only when offline. */}
      <OfflineBanner />

      <div style={{ fontFamily: "system-ui, sans serif", maxWidth: "600px", margin: "0 auto", padding: "2rem" }}>
        {/* Simple nav. <Link> changes the URL without a full page reload. */}
        <nav style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
          <Link to="/">Home</Link>
          {user ? (
            <>
              <Link to="/friends">Friends</Link>
              <button onClick={handleLogout}>Log out</button>
            </>
          ): (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link> 
            </>
          )}
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/friends" element={<RequireAuth><FriendsPage /></RequireAuth>} />
        </Routes>
      </div>
    </>
  );
}
