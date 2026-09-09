import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <main style={{ lineHeight: 1.6, paddingBottom: "2rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Terms of Service</h1>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Last updated: September 2026 · Effective immediately
        </p>
      </header>

      {/* Emergency Disclaimer Banner */}
      <div
        role="alert"
        style={{
          background: "#fef2f2",
          border: "1px solid #f87171",
          borderRadius: "8px",
          padding: "1.25rem",
          marginBottom: "2rem",
          color: "#991b1b",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginTop: 0, marginBottom: "0.5rem", color: "#991b1b" }}>
          ⚠️ Critical Notice: Not an Emergency Service
        </h2>
        <p style={{ margin: 0, fontSize: "0.95rem" }}>
          <strong>Check-in is not an emergency response service</strong> and is not connected to police, ambulance, fire, or professional crisis intervention services. If you or someone you know is in immediate physical danger, experiencing a medical emergency, or in acute crisis, please contact your local emergency services immediately (e.g., <strong>999</strong>, <strong>112</strong>, or <strong>911</strong>) or a dedicated crisis hotline.
        </p>
      </div>

      <section style={{ marginBottom: "2rem" }}>
        <h2>1. Purpose of the Service</h2>
        <p>
          Check-in provides a peer-to-peer web platform enabling individuals to send low-friction check-in signals (such as <em>"I need a chat"</em>, <em>"I'm not okay"</em>, or <em>"Could someone reach out"</em>) to a closed, mutually agreed circle of friends.
        </p>
        <p>
          The service is designed for personal support among trusted peers. It does not provide medical, psychological, or crisis management advice.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>2. Mutual Consent and Closed Circle Model</h2>
        <p>
          Check-in operates strictly on a model of mutual consent:
        </p>
        <ul>
          <li>
            <strong>Friend Relationships:</strong> Both parties must explicitly agree to establish a friendship. You cannot broadcast check-ins to arbitrary or non-consenting users.
          </li>
          <li>
            <strong>Visibility:</strong> Your active check-in alerts, notes, acknowledgements, related chat messages, and file attachments are accessible only to you and your confirmed friends.
          </li>
          <li>
            <strong>Unfriending:</strong> Either party may terminate a friendship at any time. Doing so immediately revokes access to each other's active alerts and future notifications.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>3. User Accounts and Security</h2>
        <p>
          To access the service, you must create an account using a valid email address and password.
        </p>
        <ul>
          <li>You are responsible for safeguarding your password and account credentials.</li>
          <li>You agree to provide accurate information and not impersonate any person or entity.</li>
          <li>Each user is limited to one active check-in at any given time.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>4. Acceptable Use Policy</h2>
        <p>You agree not to use the service to:</p>
        <ul>
          <li>Harass, intimidate, stalk, or send abusive content to other users.</li>
          <li>Transmit malicious software, spam, or attempt unauthorized access to the application infrastructure.</li>
          <li>Probe, scan, or test the vulnerability of our authentication or API endpoints.</li>
        </ul>
        <p>
          Violation of these rules may result in immediate suspension or termination of your account.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>5. Service Availability and Real-Time Delivery</h2>
        <p>
          While we strive for high reliability and instantaneous WebSocket alert delivery, the service is provided on an <strong>"as is"</strong> and <strong>"as available"</strong> basis. We cannot guarantee that real-time notifications will never be delayed or interrupted by network failures, browser power-saving restrictions, or server maintenance.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>6. Account Termination and Right to Erasure</h2>
        <p>
          You may stop using Check-in at any time. Under our GDPR compliance framework, you have the absolute right to permanently delete your account and all associated records (friendships, alerts, acknowledgements, messages, uploaded files, and avatars) from our database and our file storage.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>7. Changes to These Terms</h2>
        <p>
          We may update these terms occasionally to reflect technical improvements or legal requirements. Material updates will be communicated through the application interface.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>8. Contact & Privacy</h2>
        <p>
          For information on how we collect, store, and protect your personal data, please review our{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  );
}
