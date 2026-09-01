import { Link } from "react-router-dom";

// Footer links underline on hover. Unlike the nav, they sit in a line of
// grey text with no bar and no hover background to mark them, so the
// underline is what identifies them as links.
const footerLink =
  "text-ink-muted rounded-sm transition-colors " +
  "hover:text-ink hover:underline underline-offset-2" + 
  "focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export default function Footer() {
  return (
      <footer className="mt-16 border-t border-line pt-6 text-center text-sm leading-normal text-ink-muted">
      {/* Deliberately a plain paragraph, not <Banner tone="danger">. Banner
          uses role="alert", which would interrupt a screen reader with this
          on every single page load. It is permanent page furniture, not news. */}
      <p className="mb-5 text-ink">
        ⚠️ Check-in is not an emergency service. In an emergency, call 999 or 112 immediately.
      </p>

      {/* aria-label matters here: this is the second <nav> landmark on the
          page, so it needs a name to tell it apart from the main one. */}

      <nav
        aria-label="Legal and site links"
        className="mb-3 flex flex-wrap justify-center gap-6"
      >

        <Link to="/terms" className={footerLink}>Terms of Service</Link>
        <Link to="/privacy" className={footerLink}>Privacy Policy</Link>
        <Link to="/" className={footerLink}>Home</Link>
      </nav>

      <p>
        <em>ft_transcendence</em> · Built as part of the 42 curriculum.
      </p>
    </footer>
  );
}
