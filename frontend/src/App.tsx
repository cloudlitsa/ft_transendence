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
import Button from "./components/ui/Button.tsx";

// Shared styling for the nav links. Declared once rather than repeated on five
// <Link>s, so the nav stays consistent by construction. The focus ring matches
// Button's, so keyboard focus looks the same everywhere in the app.
const navLink =
  "rounded-md px-1 py-0.5 text-ink-muted transition-colors hover:text-ink " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 " +
  "focus-visible:ring-offset-2";

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
      
      {/* The app shell. p-4 md:p-8 is the responsive half of TRAN-45: 1rem of
          padding on a phone, 2rem from 768px up. The old inline style was a
          fixed 2rem, and an inline style has nowhere to put a media query. */}

      <div className="font-sans max-w-xl mx-auto p-4 md:p-8 min-h-screen flex flex-col">
        {/* Simple nav. <Link> changes the URL without a full page reload.
            The links navigate; Log out performs an action, so it's a Button.
            That difference is deliberate - it's the same distinction that
            decides <a> vs <button> for assistive tech. */}

        <nav className="flex flex-wrap items-center gap-4 mb-8">
          <Link to="/" className={navLink}>Home</Link>
          {loading ? null : user ? (
            <>
              <Link to="/profile" className={navLink}>Profile</Link>
              <Link to="/friends" className={navLink}>Friends</Link>
              <Link to="/alerts" className={navLink}>Check-ins</Link>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className={navLink}>Log in</Link>
              <Link to="/signup" className={navLink}>Sign up</Link> 
            </>
          )}
        </nav>

        {/* flex-1 makes the page area absorb the spare height, which keeps the
            footer at the bottom of the viewport on short pages. */}

        <div className="flex-1">
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
