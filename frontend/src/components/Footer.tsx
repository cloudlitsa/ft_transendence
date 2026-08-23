import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: "4rem",
        paddingTop: "1.5rem",
        borderTop: "1px solid #e5e7eb",
        color: "#6b7280",
        fontSize: "0.85rem",
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      <div style={{ marginBottom: "0.75rem" }}>
        <p style={{ margin: "0 0 0.5rem 0", color: "#b91c1c", fontWeight: 500 }}>
          ⚠️ Check-in is not an emergency service. In an emergency, call 999 or 112 immediately.
        </p>
      </div>

      <nav
        aria-label="Legal and site links"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "1.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <Link to="/terms" style={{ color: "#4f46e5", textDecoration: "underline" }}>
          Terms of Service
        </Link>
        <Link to="/privacy" style={{ color: "#4f46e5", textDecoration: "underline" }}>
          Privacy Policy
        </Link>
        <Link to="/" style={{ color: "#4f46e5", textDecoration: "underline" }}>
          Home
        </Link>
      </nav>

      <p style={{ margin: 0 }}>
        <em>ft_transcendence</em> · Built as part of the 42 curriculum.
      </p>
    </footer>
  );
}
