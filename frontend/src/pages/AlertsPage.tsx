import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider.tsx";
import { Link } from "react-router-dom";
import { useAlerts } from "../lib/AlertsContext.tsx";
import { useAuth } from "../lib/AuthContext.tsx";

import Button from "../components/ui/Button.tsx";
import Card from "../components/ui/Card.tsx";
import Heading from "../components/ui/Heading.tsx";
import Spinner from "../components/ui/Spinner.tsx";

// ---------- Types matching the backend responses ----------
// These mirror the `select` blocks in backend/src/routes/alerts.ts. If that
// select changes, this changes too — there is no shared type package, so the
// contract lives in two places and drifts silently if you forget.

// Matches the Prisma AlertType enum and the z.enum in sendAlertSchema.
export type AlertType = "need_chat" | "not_okay" | "reach_out";

// The trimmed-down user the backend sends alongside an alert.
export interface AlertUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

// My own active alert. `acknowledgements` here is the FULL list — everyone who
// has said "I see you" — because the backend selects them with their user.
export interface MyAlert {
  id: string;
  alertType: AlertType;
  note: string | null;
  status: string;
  createdAt: string; // JSON has no Date type: this arrives as an ISO string
  acknowledgements: {
    acknowledgedAt: string;
    user: AlertUser;
  }[];
}

// A friend's active alert. Note the difference: `acknowledgements` is filtered
// server-side to `where: { userId: me }`, so it holds AT MOST ONE entry and it
// is always mine. Its length is the answer to "have I already responded?" —
// that is why the array is here at all.
export interface FriendAlert {
  id: string;
  alertType: AlertType;
  note: string | null;
  createdAt: string;
  sender: AlertUser;
  acknowledgements: { acknowledgedAt: string }[];
}

// A closed check-in I was part of. No acknowledgements: the row is a way back
// into the conversation, not something to act on. closedAt is nullable in the
// schema, so it is nullable here too.
export interface PastAlert {
  id: string;
  alertType: AlertType;
  note: string | null;
  closedAt: string | null;
  sender: AlertUser;
}

interface AlertsResponse {
  myAlert: MyAlert | null;
  friendsAlerts: FriendAlert[];
  pastAlerts: PastAlert[];
}

// We also need the friends list, but only its length — to tell "you have no
// friends yet" apart from "your friends are all fine". Same shape FriendsPage
// uses; we ignore everything inside it.
interface FriendsResponse {
  friends: unknown[];
}

// ---------- Display text for the three alert types ----------
// One array drives both the radio group and the labels shown on alert cards,
// so the wording can never disagree between the two.
const ALERT_TYPES: { value: AlertType; label: string; hint: string }[] = [
  {
    value: "need_chat",
    label: "I need a chat",
    hint: "Nothing urgent — you'd just like someone to talk to.",
  },
  {
    value: "not_okay",
    label: "I'm not okay",
    hint: "You're struggling and want your circle to know.",
  },
  {
    value: "reach_out",
    label: "Could someone reach out",
    hint: "You'd like a friend to make the first move.",
  },
];

// How many past check-ins to show before the expand button. Two is enough to
// read as a list without letting the archive outweigh the check-ins that need
// attention now — the same reason GET /api/alerts caps pastAlerts at 20.
//
// The button counts what clicking it adds, not the total, because the first
// two are already on screen. It never says "all" either: with the cap in place
// we cannot promise the list is complete.
const PAST_PREVIEW = 2;

// Turn a stored value into its display label. Falls back to the raw value so a
// new enum member added to the backend shows up as itself rather than blank.
function labelFor(type: AlertType): string {
  return ALERT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// The backend sends ISO strings. Render them in the user's own locale and
// timezone rather than showing raw UTC.
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AlertsPage() {
  // ---------- State ----------
  const [myAlert, setMyAlert] = useState<MyAlert | null>(null);
  const { friendsAlerts, setFriendsAlerts, ackVersion } = useAlerts();
  const [pastAlerts, setPastAlerts] = useState<PastAlert[]>([]);
  // Past check-ins are a reference, not something to act on, so only the most
  // recent few are shown until asked for. Collapsed by default rather than
  // hidden entirely: an empty-looking section reads as a broken feature.
  const [showAllPast, setShowAllPast] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Form state for the send-an-alert section. `null` means nothing chosen yet,
  // which is deliberate: with no preselected type the submit button cannot do
  // anything until the user has actively made a choice. That is our substitute
  // for a confirmation dialog.
  const [selectedType, setSelectedType] = useState<AlertType | null>(null);
  const [note, setNote] = useState("");

  // In-flight guards. Without these, a double-click sends two alerts — the
  // second gets a 409 from the partial unique index and the user sees an error
  // for something they did right.
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null); // ack/close in flight

  const toast = useToast();

  // ---------- Load everything ----------
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    setError(null);            // clear any previous failure before retrying
    try {
      // Both requests go out at once rather than one after the other. They
      // don't depend on each other, so waiting for the first before starting
      // the second would just be slower.
      const [alertsRes, friendsRes] = await Promise.all([
        api.get<AlertsResponse>("/alerts"),
        api.get<FriendsResponse>("/friends"),
      ]);
      setMyAlert(alertsRes.myAlert);
      setFriendsAlerts(alertsRes.friendsAlerts);
      setPastAlerts(alertsRes.pastAlerts ?? []);
      setFriendCount(friendsRes.friends.length);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);       // NEW: survives longer than the toast
      toast.error("Couldn't load alerts: " + message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []); // empty deps: run once on mount. See DEVELOPMENT.md on why this
  // array matters — a missing or wrong one is how the WebSocket effect ended
  // up rebuilding its socket every three seconds.

  // The socket received alert:ack — which only the sender ever gets — and bumped
  // the counter. Re-fetch rather than patching myAlert from the socket payload:
  // the server stays the single source of truth, same rule as everywhere else in
  // this file. The counter is a signal that something changed, not the change.
  useEffect(() => {
    if (ackVersion > 0) refresh();
  }, [ackVersion]); // refresh omitted deliberately: it's redefined every render,
  // so including it would re-run this on every render

  // ---------- Actions ----------
  async function sendAlert(e: FormEvent) {
    e.preventDefault(); // stop the browser doing a full-page form submit
    if (!selectedType) return; // belt and braces; the button is also disabled

    setSending(true);
    try {
      // Send `note` only when there is something in it. An empty string would
      // pass the backend's .max(500) and store "" — a note that exists but says
      // nothing. `undefined` makes Prisma leave the column NULL, which is what
      // "no note" actually means.
      const trimmed = note.trim();
      await api.post("/alerts", {
        alertType: selectedType,
        ...(trimmed ? { note: trimmed } : {}),
      });
      toast.success("Your check-in has been sent");
      setSelectedType(null);
      setNote("");
      refresh(); // re-fetch rather than patching state: the server stays the
      // single source of truth, per DEVELOPMENT.md
    } catch (err) {
      // Covers the 409 ("you already have an active alert") — which can happen
      // legitimately if another tab sent one since this page loaded.
      toast.error((err as Error).message);
      refresh(); // our view is stale either way — go and get the truth
    } finally {
      setSending(false);
    }
  }

  async function acknowledge(id: string) {
    setBusyId(id);
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      toast.success("They know you've seen it");
      refresh();
    } catch (err) {
      // A 404 here usually means the sender closed the alert between our page
      // loading and this click. The backend's message is deliberately vague
      // (anti-probing), so we don't try to improve on it.
      toast.error((err as Error).message);
      refresh(); // our view is stale either way — go and get the truth
    } finally {
      setBusyId(null);
    }
  }

  async function closeAlert(id: string) {
    setBusyId(id);
    try {
      await api.post(`/alerts/${id}/close`);
      toast.success("Alert closed");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  // ---------- Render ----------
  // Shared shell classes: same width on all three returns (loading, error,
  // loaded) so the layout doesn't jump sideways when the state changes.
  // No p-* here — App.tsx already provides p-4 md:p-8; padding twice would
  // double up on every page.
  const shell = "mx-auto w-full max-w-xl";

  if (loading) {
    // role="status" + aria-live tells a screen reader that this region will be
    // replaced when the data arrives, instead of it announcing nothing.
    // The Spinner is decorative here — the word "Loading…" is the announcement.
    return (
      <main className={shell}>
        <Heading level={1}>Check-ins</Heading>
        <p
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center gap-2 text-ink-muted"
        >
          <Spinner />
          Loading…
        </p>
      </main>
    );
  }


  if (error) {
    return (
      <main className={`${shell} flex flex-col gap-4`}>
        <Heading level={1}>Check-ins</Heading>
        {/* role="alert" is announced immediately, interrupting. Correct here:
            everything below would otherwise be a confident lie. */}
        <p role="alert" className="text-ink">
          Couldn't load your check-ins: {error}
        </p>
        <div>
          <Button
            type="button"
            onClick={() => {
              setLoading(true);
              refresh();
            }}
          >
            Try again
          </Button>
        </div>
      </main>
    );
  }


  return (
    // gap-8 between the h1 and each section; sections manage their own
    // internal spacing. One flex column instead of margins on every child.
    <main className={`${shell} flex flex-col gap-8`}>
      <Heading level={1}>Check-ins</Heading>
 
      {/* ---------- Section 1: send an alert ---------- */}
      {/* Hidden entirely while I have an active alert, because the API returns
          409 in that case. */}
      {!myAlert && (
        <section aria-label="Send a check-in" className="flex flex-col gap-4">
          <Heading level={2}>
            Send a check-in
          </Heading>
 
          {friendCount === 0 && (
            <p className="text-ink-muted">
              You haven't added any friends yet, so nobody would receive this.{" "}
              <Link to="/friends" className="text-brand-600 underline">
                Add a friend first.
              </Link>
            </p>
          )}
 
          <form onSubmit={sendAlert} className="flex flex-col gap-4">
            {/* A radio group is a single question with several answers, so it
                belongs in a fieldset with a legend. Screen readers announce the
                legend before each option, so "I need a chat" is heard as an
                answer to "What would you like to say?" rather than free-floating. */}
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-medium text-ink">
                What would you like to say?
              </legend>
 
              {ALERT_TYPES.map((t) => (
                <div key={t.value}>
                  {/* The <label> wraps the input, so the whole line is a click
                      target and no matching id/htmlFor pair can rot. */}
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="alertType"
                      value={t.value}
                      checked={selectedType === t.value}
                      onChange={() => setSelectedType(t.value)}
                      aria-describedby={`hint-${t.value}`}
                      className="accent-brand-600"
                    />
                    <span className="text-ink">{t.label}</span>
                  </label>
                  {/* ml-6 = radio width (~1rem) + the gap-2 (0.5rem), so the
                      hint lines up under the label text, not under the radio. */}
                  <p id={`hint-${t.value}`} className="ml-6 text-sm text-ink-muted">
                    {t.hint}
                  </p>
                </div>
              ))}
            </fieldset>
 
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">
                Add a note (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500} // matches the backend's .max(500)
                rows={3}
                className="border border-line rounded-md px-3 py-2 bg-surface-sunken resize-none 
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </label>
            {/* Live count, so the limit is visible before it bites.
                -mt-3 pulls it up against the textarea it belongs to, undoing
                most of the form's gap-4 for this one pairing. */}
            <p className="-mt-3 text-right text-sm text-ink-muted">
              {note.length}/500
            </p>
 
            {/* Disabled until a type is chosen, and while a send is in flight.
                No confirmation dialog: choosing a type is already a deliberate
                act, and a misfire is undone with one click on Close.
                Button's `loading` handles spinner + disabled together, same as
                LoginPage. The wrapping div stops the button stretching to full
                width inside the flex column. */}
            <div>
              <Button type="submit" variant="alert" loading={sending} disabled={!selectedType}>
                Send check-in
              </Button>
            </div>
          </form>
 
          {/* Deliberately `ink`, not red: red is reserved for destructive
              actions and errors, and this is information, not an error.
              Same rule as the footer's disclaimer — already documented. */}
          <p className="text-sm text-ink">
            This is not an emergency service. If you or someone else is in
            immediate danger, call 999.
          </p>
        </section>
      )}

      {/* ---------- Section 2: my active alert ---------- */}
      <section aria-label="Your active check-in" className="flex flex-col gap-3">
        <Heading level={2}>
          Your active check-in
        </Heading>
 
        {!myAlert ? (
          <p className="text-ink-muted">You don't have an active check-in.</p>
        ) : (
          <Card>
            <article className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-ink">
                {labelFor(myAlert.alertType)}
              </h3>
              <p className="text-sm text-ink-muted">
                Sent {formatWhen(myAlert.createdAt)}
              </p>
              {/* wrap-break-word: a 500-char note with no spaces must wrap, not
                  push the card wider than the phone screen. */}
              {myAlert.note && (
                <p className="wrap-break-word text-ink">{myAlert.note}</p>
              )}
 
              {myAlert.acknowledgements.length === 0 ? (
                <p className="text-ink-muted">No one has responded yet.</p>
              ) : (
                <>
                  <p className="text-ink">
                    {myAlert.acknowledgements.length}{" "}
                    {/* singular/plural: "1 friend has" vs "3 friends have" */}
                    {myAlert.acknowledgements.length === 1
                      ? "friend has"
                      : "friends have"}{" "}
                    seen this:
                  </p>
                  <ul className="flex flex-col gap-1">
                    {myAlert.acknowledgements.map((a) => (
                      // The composite PK (alertId, userId) guarantees one row
                      // per user, so the user id is a safe React key here.
                      <li key={a.user.id} className="text-sm text-ink">
                        {a.user.displayName}{" "}
                        <span className="text-ink-muted">
                          — {formatWhen(a.acknowledgedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
 
              {/* THE FIX for "Close this check-inOpen conversation →":
                  one flex row with a gap. flex-wrap so at 375px the two
                  controls stack instead of overflowing sideways.
                  Link stays a link (navigation), Button stays a button
                  (action) — the visual difference tells the user which is
                  which before they read the words. */}
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => closeAlert(myAlert.id)}
                  loading={busyId === myAlert.id}
                  disabled={busyId !== null}
                >
                  Close this check-in
                </Button>
                <Link
                  to={`/alerts/${myAlert.id}`}
                  className="font-medium text-brand-600 underline"
                >
                  Open conversation →
                </Link>
              </div>
            </article>
          </Card>
        )}
      </section>
 


      {/* ---------- Section 3: friends' active alerts ---------- */}
      <section aria-label="Friends who need something" className="flex flex-col gap-3">
        <Heading level={2}>
          Friends who need something
        </Heading>
 
        {/* Three distinct empty states. friendsAlerts being empty means two
            completely different things depending on friendCount, which is the
            only reason this page fetches /friends at all. */}
        {friendCount === 0 ? (
          <p className="text-ink-muted">
            You haven't added any friends yet.{" "}
            <Link to="/friends" className="text-brand-600 underline">
              Add a friend
            </Link>{" "}
            to start checking in on each other.
          </p>
        ) : friendsAlerts.length === 0 ? (
          <p className="text-ink-muted">
            None of your friends has an active check-in right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {friendsAlerts.map((alert) => {
              // Filtered server-side to my own acknowledgement, so a non-empty
              // array means "I have already responded to this one".
              const iHaveAcknowledged = alert.acknowledgements.length > 0;
 
              return (
                <li key={alert.id}>
                  <Card>
                    <article className="flex flex-col gap-2">
                      <h3 className="text-lg font-semibold text-ink">
                        {alert.sender.displayName}: {labelFor(alert.alertType)}
                      </h3>
                      <p className="text-sm text-ink-muted">
                        Sent {formatWhen(alert.createdAt)}
                      </p>
                      {alert.note && (
                        <p className="wrap-break-word text-ink">{alert.note}</p>
                      )}
 
                      {iHaveAcknowledged && (
                        <p className="text-sm text-ink-muted">
                          You responded{" "}
                          {formatWhen(alert.acknowledgements[0].acknowledgedAt)}.
                        </p>
                      )}
 
                      <div className="mt-2 flex flex-wrap items-center gap-4">
                        {/* "I see you" is THE action on a friend's alert, so
                            here the button is primary — the opposite weighting
                            from my own card, where Close is secondary. */}
                        {!iHaveAcknowledged && (
                          <Button
                            type="button"
                            onClick={() => acknowledge(alert.id)}
                            loading={busyId === alert.id}
                            disabled={busyId !== null}
                          >
                            I see you
                          </Button>
                        )}
                        <Link
                          to={`/alerts/${alert.id}`}
                          className="font-medium text-brand-600 underline"
                        >
                          Open conversation →
                        </Link>
                      </div>
                    </article>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- Section 4: past check-ins ---------- */}
      {/* The only route back into a finished conversation: GET /api/alerts
          returns active alerts only, so nothing else links to a closed one.
          Read-only, but an attachment's author can still remove it. */}
      <section aria-label="Past check-ins" className="flex flex-col gap-3">
        <Heading level={2}>Past check-ins</Heading>

        {pastAlerts.length === 0 ? (
          <p className="text-ink-muted">
            Check-ins you were part of will appear here once they're closed.
          </p>
        ) : (
          <ul id="past-check-ins" className="flex flex-col gap-4">
            {(showAllPast ? pastAlerts : pastAlerts.slice(0, PAST_PREVIEW)).map((alert) => (
              <li key={alert.id}>
                <Card>
                  <article className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-ink">
                      {alert.sender.id === user?.id
                        ? "You"
                        : alert.sender.displayName}
                      : {labelFor(alert.alertType)}
                    </h3>
                    {alert.closedAt && (
                      <p className="text-sm text-ink-muted">
                        Closed {formatWhen(alert.closedAt)}
                      </p>
                    )}
                    {alert.note && (
                      <p className="wrap-break-word text-ink">{alert.note}</p>
                    )}

                    <div className="mt-2">
                      {/* "Read", not "Open" — the wording says up front that
                          nothing can be added to this one. */}
                      <Link
                        to={`/alerts/${alert.id}`}
                        className="font-medium text-brand-600 underline"
                      >
                        Read conversation →
                      </Link>
                    </div>
                  </article>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {pastAlerts.length > PAST_PREVIEW && (
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAllPast((open) => !open)}
              aria-expanded={showAllPast}
              aria-controls="past-check-ins"
            >
              {showAllPast
                ? "Show fewer"
                : `Show ${pastAlerts.length - PAST_PREVIEW} more`}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}

