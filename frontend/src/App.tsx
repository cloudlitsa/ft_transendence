import { Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignupPage from "./pages/SignupPage.tsx";
import FriendsPage from "./pages/FriendsPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import UserProfilePage from "./pages/UserProfilePage.tsx";
import AlertsPage from "./pages/AlertsPage.tsx";
import TermsPage from "./pages/TermsPage.tsx";
import PrivacyPage from "./pages/PrivacyPage.tsx";
import Footer from "./components/Footer.tsx";

import OfflineBanner from "./components/OfflineBanner.tsx";
import { useAlertSocket } from "./lib/useAlertSocket.ts";
import { useAuth } from "./lib/AuthContext.tsx";
import RequireAuth from "./components/RequireAuth.tsx";

// App is now the router for the whole app. It decides what page to render based on the URL path.
// Routes is a container for all the Route components. Each Route component defines a path and the component to render when the path matches the URL.
export default function App() {
  useAlertSocket();
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  async function handleLogout() {
    await logout();
    navigate("/login");
  }
  return (
    // Fragment (<>...</>) lets us return the full-width banner alongside the
    // centered content without adding an extra wrapping element.
    <>
      {/* Full-width bar at the very top; renders only when offline. */}
      <OfflineBanner />

      <div style={{ fontFamily: "system-ui, sans serif", maxWidth: "600px", margin: "0 auto", padding: "2rem", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Simple nav. <Link> changes the URL without a full page reload. */}
        <nav style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link to="/">Home</Link>
          {loading ? null : user ? (
            <>
              <Link to="/profile">Profile</Link>
              <Link to="/friends">Friends</Link>
              <Link to="/alerts">Check-ins</Link>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link> 
            </>
          )}
        </nav>

        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/friends" element={<RequireAuth><FriendsPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/profile/:id" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
            <Route path="/alerts" element={<RequireAuth><AlertsPage /></RequireAuth>} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </>
  );
}
