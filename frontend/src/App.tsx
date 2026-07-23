import { Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignupPage from "./pages/SignupPage.tsx";
import FriendsPage from "./pages/FriendsPage.tsx";
// nav:    <Link to="/friends">Friends</Link>
// routes: <Route path="/friends" element={<FriendsPage />} />

// App is now the router for the whole app. It decides what page to render based on the URL path.
// Routes is a container for all the Route components. Each Route component defines a path and the component to render when the path matches the URL.
export default function App() {
  return (
    <div style={{ fontFamily: "system-ui, sans serif", maxWidth: "600px", margin: "0 auto", padding: "2rem" }}>
      {/* Simple nav. <Link> changes the URL without a full page reload. */}
      <nav style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <Link to="/">Home</Link>
        <Link to="/login">Log in</Link>
        <Link to="/signup">Sign up</Link>
        <Link to="/friends">Friends</Link>
      </nav>
 
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/friends" element={<FriendsPage />} />
      </Routes>
    </div>
  );
}
