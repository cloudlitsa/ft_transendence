import { Link } from "react-router-dom";
import Heading from "../components/ui/Heading";
import Banner from "../components/ui/Banner";

const listClasses = "list-disc pl-6 space-y-2";
// Links inside a sentence need a cue besides colour (WCAG 1.4.1), so they
// keep a soft underline. Footer links stand alone in a nav, so hover-only is fine there.
const textLink =
  "text-brand-600 underline decoration-brand-600/40 underline-offset-2 " +
  "hover:decoration-brand-600 rounded-sm " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export default function TermsPage() {
  return (
    <main className="leading-relaxed pb-8">
      <header className="mb-8">
        <Heading level={1} className="mb-2">Terms of Service</Heading>
        <p className="text-sm text-ink-muted">
          Last updated: September 2026 · Effective immediately
        </p>
      </header>

      {/* Emergency Disclaimer Banner */}
      <Banner tone="warning" live={false} className="mb-8">
        <Heading level={3} as="h2" className="mb-1">
          Critical Notice: Not an Emergency Service
        </Heading>
        <p>
          <strong>Check-in is not an emergency response service</strong> and is not connected to police, ambulance, fire, or professional crisis intervention services. If you or someone you know is in immediate physical danger, experiencing a medical emergency, or in acute crisis, please contact your local emergency services immediately (e.g., <strong>999</strong>, <strong>112</strong>, or <strong>911</strong>) or a dedicated crisis hotline.
        </p>
      </Banner>

      <section className="mb-8 space-y-4">
        <Heading level={2}>1. Purpose of the Service</Heading>
        <p>
          Check-in provides a peer-to-peer web platform enabling individuals to send low-friction check-in signals (such as <em>"I need a chat"</em>, <em>"I'm not okay"</em>, or <em>"Could someone reach out"</em>) to a closed, mutually agreed circle of friends.
        </p>
        <p>
          The service is designed for personal support among trusted peers. It does not provide medical, psychological, or crisis management advice.
        </p>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>2. Mutual Consent and Closed Circle Model</Heading>
        <p>
          Check-in operates strictly on a model of mutual consent:
        </p>
        <ul className={listClasses}>
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

      <section className="mb-8 space-y-4">
        <Heading level={2}>3. User Accounts and Security</Heading>
        <p>
          To access the service, you must create an account using a valid email address and password.
        </p>
        <ul className={listClasses}>
          <li>You are responsible for safeguarding your password and account credentials.</li>
          <li>You agree to provide accurate information and not impersonate any person or entity.</li>
          <li>Each user is limited to one active check-in at any given time.</li>
        </ul>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>4. Acceptable Use Policy</Heading>
        <p>You agree not to use the service to:</p>
        <ul className={listClasses}>
          <li>Harass, intimidate, stalk, or send abusive content to other users.</li>
          <li>Transmit malicious software, spam, or attempt unauthorized access to the application infrastructure.</li>
          <li>Probe, scan, or test the vulnerability of our authentication or API endpoints.</li>
        </ul>
        <p>
          Violation of these rules may result in immediate suspension or termination of your account.
        </p>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>5. Service Availability and Real-Time Delivery</Heading>
        <p>
          While we strive for high reliability and instantaneous WebSocket alert delivery, the service is provided on an <strong>"as is"</strong> and <strong>"as available"</strong> basis. We cannot guarantee that real-time notifications will never be delayed or interrupted by network failures, browser power-saving restrictions, or server maintenance.
        </p>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>6. Account Termination and Right to Erasure</Heading>
        <p>
          You may stop using Check-in at any time. Under our GDPR compliance framework, you have the absolute right to permanently delete your account and all associated records (friendships, alerts, acknowledgements, messages, uploaded files, and avatars) from our database and our file storage.
        </p>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>7. Changes to These Terms</Heading>
        <p>
          We may update these terms occasionally to reflect technical improvements or legal requirements. Material updates will be communicated through the application interface.
        </p>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>8. Contact & Privacy</Heading>
        <p>
          For information on how we collect, store, and protect your personal data, please review our{" "}
          <Link to="/privacy" className={textLink}>
            Privacy Policy
          </Link>.
        </p>
      </section>
    </main>
  );
}
