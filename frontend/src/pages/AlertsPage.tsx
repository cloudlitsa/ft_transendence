import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider.tsx";
import { Link } from "react-router-dom";
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

interface AlertsResponse {
  myAlert: MyAlert | null;
  friendsAlerts: FriendAlert[];
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
  const [friendsAlerts, setFriendsAlerts] = useState<FriendAlert[]>([]);
  const [friendCount, setFriendCount] = useState(0);
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
  if (loading) {
    // role="status" + aria-live tells a screen reader that this region will be
    // replaced when the data arrives, instead of it announcing nothing.
    return (
      <main>
        <h1>Check-ins</h1>
        <p role="status" aria-live="polite">
          Loading…
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>Check-ins</h1>
        {/* role="alert" is announced immediately, interrupting. Correct here:
            everything below would otherwise be a confident lie. */}
        <p role="alert">Couldn't load your check-ins: {error}</p>
        <button type="button" onClick={() => { setLoading(true); refresh(); }}>Try again</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Check-ins</h1>

      {/* ---------- Section 1: send an alert ---------- */}
      {/* Hidden entirely while I have an active alert, because the API returns
          409 in that case. Showing a form that is guaranteed to fail would be
          teaching the user to expect errors. */}
      {!myAlert && (
        <section aria-labelledby="send-heading">
          <h2 id="send-heading">Send a check-in</h2>

          {friendCount === 0 && (
            <p>
              You haven't added any friends yet, so nobody would receive this.{" "}
              <Link to="/friends">Add a friend first.</Link>
            </p>
          )}

          <form onSubmit={sendAlert}>
            {/* A radio group is a single question with several answers, so it
                belongs in a fieldset with a legend. Screen readers announce the
                legend before each option, so "I need a chat" is heard as an
                answer to "What would you like to say?" rather than free-floating. */}
            <fieldset>
              <legend>What would you like to say?</legend>

              {ALERT_TYPES.map((t) => (
                <div key={t.value}>
                  {/* The <label> wraps the input, so the whole line is a click
                      target and no matching id/htmlFor pair can rot. */}
                  <label>
                    <input
                      type="radio"
                      name="alertType"
                      value={t.value}
                      checked={selectedType === t.value}
                      onChange={() => setSelectedType(t.value)}
                      aria-describedby={`hint-${t.value}`}
                    />{" "}
                    {t.label}
                  </label>
                  <p id={`hint-${t.value}`}>{t.hint}</p>
                </div>
              ))}
            </fieldset>

            <label>
              Add a note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500} // matches the backend's .max(500)
                rows={3}
              />
            </label>
            {/* Live count, so the limit is visible before it bites. */}
            <p>{note.length}/500</p>

            {/* Disabled until a type is chosen, and while a send is in flight.
                No confirmation dialog: choosing a type is already a deliberate
                act, and a misfire is undone with one click on Close. */}
            <button type="submit" disabled={!selectedType || sending}>
              {sending ? "Sending…" : "Send check-in"}
            </button>
          </form>

          <p>
            This is not an emergency service. If you or someone else is in
            immediate danger, call 999.
          </p>
        </section>
      )}

      {/* ---------- Section 2: my active alert ---------- */}
      <section aria-labelledby="mine-heading">
        <h2 id="mine-heading">Your active check-in</h2>

        {!myAlert ? (
          <p>You don't have an active check-in.</p>
        ) : (
          <article>
            <h3>{labelFor(myAlert.alertType)}</h3>
            <p>Sent {formatWhen(myAlert.createdAt)}</p>
            {myAlert.note && <p>{myAlert.note}</p>}

            {myAlert.acknowledgements.length === 0 ? (
              <p>No one has responded yet.</p>
            ) : (
              <>
                <p>
                  {myAlert.acknowledgements.length}{" "}
                  {/* singular/plural: "1 friend has" vs "3 friends have" */}
                  {myAlert.acknowledgements.length === 1
                    ? "friend has"
                    : "friends have"}{" "}
                  seen this:
                </p>
                <ul>
                  {myAlert.acknowledgements.map((a) => (
                    // The composite PK (alertId, userId) guarantees one row per
                    // user, so the user id is a safe React key here.
                    <li key={a.user.id}>
                      {a.user.displayName} — {formatWhen(a.acknowledgedAt)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button
              type="button"
              onClick={() => closeAlert(myAlert.id)}
              disabled={busyId === myAlert.id}
            >
              {busyId === myAlert.id ? "Closing…" : "Close this check-in"}
            </button>
          </article>
        )}
      </section>

      {/* ---------- Section 3: friends' active alerts ---------- */}
      <section aria-labelledby="friends-heading">
        <h2 id="friends-heading">Friends who need something</h2>

        {/* Three distinct empty states. friendsAlerts being empty means two
            completely different things depending on friendCount, which is the
            only reason this page fetches /friends at all. */}
        {friendCount === 0 ? (
          <p>
            You haven't added any friends yet. <Link to="/friends">Add a friend</Link>{" "}
            to start checking in on each other.
          </p>
        ) : friendsAlerts.length === 0 ? (
          <p>None of your friends has an active check-in right now.</p>
        ) : (
          <ul>
            {friendsAlerts.map((alert) => {
              // Filtered server-side to my own acknowledgement, so a non-empty
              // array means "I have already responded to this one".
              const iHaveAcknowledged = alert.acknowledgements.length > 0;

              return (
                <li key={alert.id}>
                  <article>
                    <h3>
                      {alert.sender.displayName}: {labelFor(alert.alertType)}
                    </h3>
                    <p>Sent {formatWhen(alert.createdAt)}</p>
                    {alert.note && <p>{alert.note}</p>}

                    {iHaveAcknowledged ? (
                      <p>
                        You responded{" "}
                        {formatWhen(alert.acknowledgements[0].acknowledgedAt)}.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => acknowledge(alert.id)}
                        disabled={busyId === alert.id}
                      >
                        {busyId === alert.id ? "Sending…" : "I see you"}
                      </button>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
