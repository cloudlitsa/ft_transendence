import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <main style={{ lineHeight: 1.6, paddingBottom: "2rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Privacy Policy</h1>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Last updated: August 2026 · Compliant with General Data Protection Regulation (GDPR)
        </p>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2>1. Overview & Commitment</h2>
        <p>
          Check-in is designed with privacy-first architecture. Because check-in alerts and distress signals are sensitive personal data, we adhere strictly to the core principles of the <strong>General Data Protection Regulation (GDPR)</strong>: data minimisation, purpose limitation, storage limitation, transparency, and integrity.
        </p>
        <p>
          We do not sell your data, we do not use third-party tracking or advertising SDKs, and we never expose your activity to unauthorized parties.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>2. Data We Collect</h2>
        <p>We only collect data strictly necessary to operate the service:</p>
        <ul>
          <li>
            <strong>Account Data:</strong> Your email address, display name, avatar image URL (if provided), and an encrypted password hash. We <em>never</em> store your plaintext password.
          </li>
          <li>
            <strong>Relationship Data:</strong> Confirmed friendships and pending friend invitations, including timestamps and who initiated the request.
          </li>
          <li>
            <strong>Check-in & Alert Data:</strong> The alerts you create (type of check-in, optional text notes, status, and creation/closure timestamps).
          </li>
          <li>
            <strong>Responses & Messages:</strong> Acknowledgements sent or received (<em>"I see you"</em> timestamps) and chat messages associated with an active or past check-in thread.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>3. Legal Basis for Processing</h2>
        <p>We process your personal data under the following legal bases:</p>
        <ul>
          <li>
            <strong>Performance of a Contract:</strong> To deliver real-time check-in alerts, socket broadcasts, and messaging to your designated, mutually-accepted circle of friends.
          </li>
          <li>
            <strong>Legitimate Interests:</strong> To secure user accounts, prevent brute-force attacks, protect against unauthorized access, and ensure server integrity.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>4. Cookies & Local Storage</h2>
        <p>
          We use only <strong>strictly necessary session cookies</strong>:
        </p>
        <ul>
          <li>
            <strong><code>auth_token</code>:</strong> A JSON Web Token (JWT) containing only your unique user identifier.
          </li>
          <li>
            <strong>Security Controls:</strong> Marked with <code>HttpOnly</code> (inaccessible to client-side JavaScript, mitigating XSS risks), <code>Secure</code> (transmitted only via encrypted HTTPS), and <code>SameSite=Lax</code> (protecting against CSRF).
          </li>
        </ul>
        <p>
          We do not use any third-party analytics, marketing cookies, or tracking pixels.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>5. Technical Safeguards & Data Security</h2>
        <ul>
          <li>
            <strong>Transport Layer Security (HTTPS):</strong> All communications between your browser and our servers are encrypted via TLS/HTTPS through a reverse proxy.
          </li>
          <li>
            <strong>Password Hashing:</strong> Passwords are cryptographically salted and hashed using <strong>bcrypt</strong> (cost factor 12) before being stored.
          </li>
          <li>
            <strong>Database Query Scoping:</strong> Sensitive fields (such as password hashes) are explicitly excluded from database queries and can never leak into API responses or data exports.
          </li>
          <li>
            <strong>Access Control:</strong> Alerts and messages are scoped strictly to confirmed friendships via database-level checks.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>6. Your Rights Under GDPR</h2>
        <p>
          You have full control over your personal information, enforceable directly through the application:
        </p>
        <ul>
          <li>
            <strong>Right of Access & Data Portability (Article 15 & 20):</strong> You can request and download a complete, machine-readable JSON copy of all data stored across our database (account profile, friendships, alerts, acknowledgements, and messages) via <code>GET /api/account/export</code>.
          </li>
          <li>
            <strong>Right to Erasure / "Right to be Forgotten" (Article 17):</strong> You can permanently delete your account and all associated data at any time via <code>DELETE /api/account</code> (requires password confirmation). A cascading delete immediately wipes your user record, friendships, alerts, acknowledgements, and messages.
          </li>
          <li>
            <strong>Notification Emails:</strong> Automated confirmation emails are sent upon data export or account erasure to verify the action.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>7. Data Retention</h2>
        <p>
          Your data is retained only for as long as your account remains active. When you delete your account, all personal data is permanently and irreversibly purged from our database immediately.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>8. Contact & Terms</h2>
        <p>
          For questions regarding data privacy, please reach out to the project team. For terms governing the use of this service, see our{" "}
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
