import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignupPage from "./pages/SignupPage.tsx";
import FriendsPage from "./pages/FriendsPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import UserProfilePage from "./pages/UserProfilePage.tsx";
import AlertsPage from "./pages/AlertsPage.tsx";
import TermsPage from "./pages/TermsPage.tsx";
import PrivacyPage from "./pages/PrivacyPage.tsx";
import ConversationPage from "./pages/ConversationPage.tsx";
import Footer from "./components/Footer.tsx";

import OfflineBanner from "./components/OfflineBanner.tsx";
import { useAlertSocket } from "./lib/useAlertSocket.ts";
import { useAuth } from "./lib/AuthContext.tsx";
import RequireAuth from "./components/RequireAuth.tsx";
import Button from "./components/ui/Button.tsx";

// Shared styling for the nav links. Declared once rather than repeated on five
// <NavLink>s, so the nav stays consistent by construction. The focus ring matches
// Button's, so keyboard focus looks the same everywhere in the app.
const navLinkBase =
  "rounded-md px-2 py-1 text-ink-muted transition-colors " +
  "hover:bg-surface-sunken hover:text-ink " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 " +
  "focus-visible:ring-offset-2";  
 
// The current page. Underlined as well as darkened: colour alone is not a
// sufficient indicator (WCAG 1.4.1), so there has to be a second cue.
const navLinkActive = "text-ink font-medium underline underline-offset-4";

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

  // NavLink takes className as a function so it can style the active route.
  // Written once here rather than repeated inline on every link.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${navLinkBase} ${isActive ? navLinkActive : ""}`;

  return (
    // Fragment (<>...</>) lets us return the full-width banner alongside the
    // centered content without adding an extra wrapping element.
    <>
      {/* Skip link. Visually hidden until it receives keyboard focus, which
          makes it the first thing a keyboard user reaches on every page. It
          lets them jump past the nav instead of tabbing through it on every
          single page load. */}
      <a
        href="#main-content"
        className={
          "sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 " +
          "focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ink " +
          "focus:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        }
      >
        Skip to content
      </a>

      {/* Full-width bar at the very top; renders only when offline. */}
      <OfflineBanner />
      
      {/* The app shell. p-4 md:p-8 is the responsive half of TRAN-45: 1rem of
          padding on a phone, 2rem from 768px up. The old inline style was a
          fixed 2rem, and an inline style has nowhere to put a media query. */}

      <div className="font-sans max-w-xl mx-auto p-4 md:p-8 min-h-screen flex flex-col">
        {/* NavLink adds aria-current="page" on the matching route by itself,
            so a screen reader announces which page you are on. The links
            navigate; Log out performs an action, so it's a Button. */}
        <nav aria-label="Main" className="flex flex-wrap items-center gap-4 mb-8">
          {/* `end` matters: without it "/" is a prefix of every route, so Home
              would be marked active on every page in the app. */}
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          {loading ? null : user ? (
            <>
              <NavLink to="/profile" end className={linkClass}>Profile</NavLink>
              <NavLink to="/friends" className={linkClass}>Friends</NavLink>
              <NavLink to="/alerts" className={linkClass}>Check-ins</NavLink>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>Log in</NavLink>
              <NavLink to="/signup" className={linkClass}>Sign up</NavLink> 
            </>
          )}
        </nav>

        {/* flex-1 makes the page area absorb the spare height, which keeps the
            footer at the bottom of the viewport on short pages. */}

        <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/friends" element={<RequireAuth><FriendsPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/profile/:id" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
            <Route path="/alerts" element={<RequireAuth><AlertsPage /></RequireAuth>} />
            <Route path="/alerts/:id" element={<RequireAuth><ConversationPage /></RequireAuth>} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </>
  );
}
