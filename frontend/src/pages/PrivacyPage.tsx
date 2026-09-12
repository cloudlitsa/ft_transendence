import { Link } from "react-router-dom";
import Heading from "../components/ui/Heading";

const listClasses = "list-disc pl-6 space-y-2";
// Links inside a sentence need a cue besides colour (WCAG 1.4.1), so they
// keep a soft underline. Footer links stand alone in a nav, so hover-only is fine there.
const textLink =
  "text-brand-600 underline decoration-brand-600/40 underline-offset-2 " +
  "hover:decoration-brand-600 rounded-sm " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export default function PrivacyPage() {
  return (
    <main className="leading-relaxed pb-8">
      <header className="mb-8">
        <Heading level={1} className="mb-2">Privacy Policy</Heading>
        <p className="text-sm text-ink-muted">
          Last updated: September 2026 · Compliant with General Data Protection Regulation (GDPR)
        </p>
      </header>

      <section className="mb-8 space-y-4">
        <Heading level={2}>1. Overview & Commitment</Heading>
        <p>
          Check-in is designed with privacy-first architecture. Because check-in alerts and distress signals are sensitive personal data, we adhere strictly to the core principles of the <strong>General Data Protection Regulation (GDPR)</strong>: data minimisation, purpose limitation, storage limitation, transparency, and integrity.
        </p>
        <p>
          We do not sell your data, we do not use third-party tracking or advertising SDKs, and we never expose your activity to unauthorized parties.
        </p>
      </section>

      <section className="mb-8 space-y-4">
       <Heading level={2}>2. Data We Collect</Heading>
        <p>We only collect data strictly necessary to operate the service:</p>
        <ul className={listClasses}>
          <li>
            <strong>Account Data:</strong> Your email address, display name, and profile avatar (if uploaded). If you sign up with an email and password, we also store a salted password hash — we <em>never</em> store your plaintext password. If you sign in with Google instead, no password exists for your account; we store the account identifier Google gives us so we can recognise you on your next visit.
          </li>
          <li>
            <strong>Data From Google Sign-In:</strong> If you choose to sign in with Google, Google shares your name and email address with us, which we use to create or recognise your account. We request nothing beyond that, and we do not post or read anything in your Google account. Google's own handling of that sign-in is governed by Google's privacy policy, not ours.
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
          <li>
            <strong>Uploaded Files & Attachments:</strong> Files you choose to upload and share within conversations (images and PDF documents attached to messages) and profile avatars, along with file metadata (original filename, MIME type, file size, and upload timestamp).
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>3. Legal Basis for Processing</Heading>
        <p>We process your personal data under the following legal bases:</p>
        <ul className={listClasses}>
          <li>
            <strong>Performance of a Contract:</strong> To deliver real-time check-in alerts, socket broadcasts, and messaging to your designated, mutually-accepted circle of friends.
          </li>
          <li>
            <strong>Legitimate Interests:</strong> To secure user accounts, prevent brute-force attacks, protect against unauthorized access, and ensure server integrity.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>4. Cookies</Heading>
        <p>
          We use only <strong>strictly necessary session cookies</strong>:
        </p>
        <ul className={listClasses}>
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

      <section className="mb-8 space-y-4">
        <Heading level={2}>5. Technical Safeguards & Data Security</Heading>
        <ul className={listClasses}>
          <li>
            <strong>Transport Layer Security (HTTPS):</strong> All communications between your browser and our servers are encrypted via TLS/HTTPS through a reverse proxy.
          </li>
          <li>
            <strong>Password Hashing:</strong> Where an account has a password, it is cryptographically salted and hashed using <strong>bcrypt</strong> (cost factor 12) before being stored. Accounts created through Google sign-in have no stored password.
          </li>
          <li>
            <strong>Database Query Scoping:</strong> Sensitive fields (such as password hashes) are explicitly excluded from database queries and can never leak into API responses or data exports.
          </li>
          <li>
            <strong>Access Control & Private File Storage:</strong> Alerts and messages are scoped strictly to confirmed friendships via database-level checks. Uploaded message attachments are stored in private file storage outside public web roots and are accessible only to authorized participants in that check-in conversation.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>6. Your Rights Under GDPR</Heading>
        <p>
          You have full control over your personal information under the General Data Protection Regulation:
        </p>
        <ul className={listClasses}>
          <li>
            <strong>Right of Access & Data Portability (Article 15 & 20):</strong> You have the right to obtain and download a complete, machine-readable JSON copy of all data stored in relation to your account (account profile, friendships, alerts, acknowledgements, messages, and uploaded file attachments).
          </li>
          <li>
            <strong>Right to Erasure / "Right to be Forgotten" (Article 17):</strong> You have the right to permanently delete your account and all associated data. When an account is deleted, a cascading deletion immediately and permanently removes your user record, friendships, alerts, acknowledgements, messages, uploaded files, and avatars from our database and our file storage.
            <br />
            Please note that deleting an account also removes that user's messages and attachments from check-in conversations started by other people. Consequently, if a friend deletes their account, messages they wrote in your check-in threads will disappear from your thread as well.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-4">
        <Heading level={2}>7. Data Retention</Heading>
        <p>
          Your data is retained only for as long as your account remains active. When you delete your account, all personal data and records — including your user profile, friendships, alerts, acknowledgements, messages, uploaded files, and avatars — are permanently and irreversibly purged from our database and our file storage immediately.
        </p>
      </section>
      <section className="mb-8 space-y-4">
        <Heading level={2}>8. Contact & Terms</Heading>
        <p>
          For questions regarding data privacy, please reach out to the project team. For terms governing the use of this service, see our{" "}
          <Link to="/terms" className={textLink}>Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
