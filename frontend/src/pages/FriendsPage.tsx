import { useEffect, useState, type FormEvent } from "react"; // React hooks let us remember state and run code when the page first renders.
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider.tsx"; // fire notifications on create/update/delete actions
import { Link } from "react-router-dom";
import { usePresence } from "../lib/PresenceContext.tsx";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Heading from "../components/ui/Heading";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";

const DEFAULT_AVATAR = "/default-avatar.png";

// ---------- Types matching the backend responses ----------
interface FriendUser { // the user on the other side of a friendship. the backend sends this shape in both /friends and /friends/pending. interface means "the other user" in the friendship, not "me".
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  online?: boolean; // only present on accepted friends (/friends), not pending
}

interface FriendEntry { // a single friendship row, either accepted or pending. the backend sends this shape in both /friends and /friends/pending.
  friendshipId: string;
  user: FriendUser;
}

interface PendingResponse { // the backend sends this shape from /friends/pending. it splits pending rows into incoming (I can accept) and outgoing (waiting). the "neutral" case where I already sent a request to the user
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

// Shared bits of every row, so the three lists can't drift apart.
// size-8 = 2rem = 32px, matching the old width/height attributes.
const avatarClass = "size-8 shrink-0 rounded-full object-cover";
const rowClass = "flex flex-wrap items-center gap-3";

export default function FriendsPage() { // the main component for the /friends page. React calls this function to render the page. It returns JSX, which looks like HTML but can include dynamic values and components.
  // ---------- State: everything the page needs to remember ----------
  const [friends, setFriends] = useState<FriendEntry[]>([]); // the list of accepted friends. useState remembers this value across renders and gives us a function to update it. when we call setFriends, React re-renders the page with the new value.
  const [incoming, setIncoming] = useState<FriendEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([]);
  const [email, setEmail] = useState("");          // the add-friend input
  const [emailError, setEmailError] = useState<string>();
  const [loading, setLoading] = useState(true); // true while we're waiting for the backend to respond. we show a "Loading…" message in this case.

  const toast = useToast(); // used to fire success/error/info notifications on actions
  const { onlineIds, seed } = usePresence();

  // ---------- Load everything from the backend ----------
  async function refresh() { // fetch friends and pending requests from the backend and update state. called once on page load, and after every action that changes the data. Async because it uses await to wait for the backend responses. We don't return anything; we just update state.
   
    try { // fetch both endpoints in parallel, then update state when both are done. Promise.all waits for both promises to resolve, and returns an array of results in the same order. If either promise rejects, Promise.all rejects immediately and we catch it below.
      const [friendsRes, pendingRes] = await Promise.all([
        api.get<{ friends: FriendEntry[] }>("/friends"), // the backend sends { friends: [...] } from /friends
        api.get<PendingResponse>("/friends/pending"), // the backend sends { incoming: [...], outgoing: [...] } from /friends/pending
      ]);
      setFriends(friendsRes.friends); // update state with the new data. React re-renders the page with the new values. friendsRes.friends is the array of accepted friends from the backend. pendingRes.incoming and pendingRes.outgoing are the arrays of incoming and outgoing pending requests.
      seed(friendsRes.friends.filter((f) => f.user.online).map((f) => f.user.id));
      setIncoming(pendingRes.incoming);
      setOutgoing(pendingRes.outgoing);
    } catch (err) { // if either request fails, we catch the error here. err is the Error object thrown by api.get, which includes the backend's error message.
      toast.error("Couldn't load friends: " + (err as Error).message);
    } finally { // finally runs whether the try block succeeded or the catch block ran. we always want to stop showing "Loading…" when we're done, even if there was an error.
      setLoading(false);
    }
  }

  // Run refresh() once when the page first renders.
  useEffect(() => {
    refresh();
  }, []); // the empty array means "run this effect only once, on mount". if we left it out, React would run refresh() on every render, which would be bad.

  // ---------- Actions ----------
  async function sendRequest(e: FormEvent) { // called when the user submits the add-friend form. e is the event object, which we can use to prevent the default form submission behavior.
    e.preventDefault(); // stop the browser doing a full-page form submit
    setEmailError(undefined);
    if (!email.trim()) {
      setEmailError("Enter your friend's email address");
      return;
    }
    try {
      const res = await api.post<{ message: string }>("/friends/request", { email }); // the backend sends { message: "..." } from /friends/request. we pass the email in the request body.
      toast.info(res.message); // neutral message ("if that person has an account, they'll receive your request")
      setEmail("");
      refresh(); // outgoing list may have a new entry
    } catch (err) {
      setEmailError((err as Error).message); // e.g. "You can't send a request to yourself"
    }
  }

  async function accept(id: string) {
    try {
      await api.post(`/friends/${id}/accept`);
      toast.success("Friend request accepted");
      refresh(); // incoming list may have a new entry, and friends list may have a new entry. Refresh() fetches both lists from the backend and updates state, which triggers a re-render with the new data.
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function declineOrCancel(id: string) {
    try {
      // The backend tells us whether this was a decline (someone else's request)
      // or a cancel (a request I sent). We show the matching message.
      const res = await api.post<{ action: string }>(`/friends/${id}/decline`);
      toast.success(res.action === "cancelled" ? "Request cancelled" : "Request declined");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function unfriend(id: string) {
    try {
      await api.delete(`/friends/${id}`);
      toast.success("Removed from friends");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ---------- Render ---------- It's JSX, which looks like HTML but can include dynamic values and components. React transforms this into JavaScript calls to create the DOM elements.
    if (loading) {
    return (
      <main>
        <Heading level={1}>Friends</Heading>
        <p role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading…
        </p>
      </main>
    );
  }
 
  return (
    <main className="flex flex-col gap-8">
      <Heading level={1}>Friends</Heading>
 
      {/* ---------- Add a friend ---------- */}
      <section aria-label="Add a friend" className="flex flex-col gap-3">
        <Heading level={2}>Add a friend</Heading>
 
        {/* Stacked on a phone, side by side from 640px. items-end lines the
            button up with the input box rather than with the label above it. */}
        <form onSubmit={sendRequest} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            {/* A visible label now, not an aria-label. Sighted users get to
                see what the field is for too. */}
            <Input
              label="Friend's email address"
              type="email"
              autoComplete="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
          </div>
          <div>
            <Button type="submit">Send request</Button>
          </div>
        </form>
      </section>
 
      {/* ---------- Incoming ---------- */}
      <section aria-label="Incoming requests" className="flex flex-col gap-3">
        <Heading level={2}>Incoming requests</Heading>
        {incoming.length === 0 ? (
          <p className="text-ink-muted">None</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {incoming.map((entry) => (
              <li key={entry.friendshipId}>
                <Card className={rowClass}>
                  <img src={entry.user.avatarUrl ?? DEFAULT_AVATAR} alt="" width={32} height={32} className={avatarClass} />
                  <div className="min-w-0">
                    <p className="text-ink">{entry.user.displayName}</p>
                    <p className="truncate text-sm text-ink-muted">{entry.user.email}</p>
                  </div>
                  {/* ml-auto pushes the buttons to the right on a wide row.
                      On a narrow one, flex-wrap drops them to their own line. */}
                  <div className="ml-auto flex gap-2">
                    <Button type="button" size="sm" onClick={() => accept(entry.friendshipId)}>
                      Accept
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => declineOrCancel(entry.friendshipId)}>
                      Decline
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
 
      {/* ---------- Outgoing ---------- */}
      <section aria-label="Outgoing requests" className="flex flex-col gap-3">
        <Heading level={2}>Outgoing requests</Heading>
        {outgoing.length === 0 ? (
          <p className="text-ink-muted">None</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {outgoing.map((entry) => (
              <li key={entry.friendshipId}>
                <Card className={rowClass}>
                  <img src={entry.user.avatarUrl ?? DEFAULT_AVATAR} alt="" width={32} height={32} className={avatarClass} />
                  <div className="min-w-0">
                    <p className="text-ink">{entry.user.displayName}</p>
                    <p className="truncate text-sm text-ink-muted">{entry.user.email}</p>
                  </div>
                  <div className="ml-auto">
                    <Button type="button" size="sm" variant="secondary" onClick={() => declineOrCancel(entry.friendshipId)}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
 
      {/* ---------- Friends ---------- */}
      <section aria-label="My friends" className="flex flex-col gap-3">
        <Heading level={2}>My friends</Heading>
        {friends.length === 0 ? (
          <p className="text-ink-muted">No friends yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {friends.map((entry) => {
              const online = onlineIds.has(entry.user.id);
              return (
                <li key={entry.friendshipId}>
                  <Card className={rowClass}>
                    <img src={entry.user.avatarUrl ?? DEFAULT_AVATAR} alt="" width={32} height={32} className={avatarClass} />
                    <Badge
                      appearance="dot"
                      tone={online ? "success" : "neutral"}
                      title={online ? "Online" : "Offline"}
                      live
                    >
                      {online
                        ? `${entry.user.displayName} is online`
                        : `${entry.user.displayName} is offline`}
                    </Badge>
                    <div className="min-w-0">
                      <Link to={`/profile/${entry.user.id}`} className="text-brand-600 underline">
                        {entry.user.displayName}
                      </Link>
                      <p className="truncate text-sm text-ink-muted">{entry.user.email}</p>
                    </div>
                    {/* Secondary, not danger. Red on every row would make the
                        friends list read like a list of errors, and unfriending
                        is undone by sending a new request. Red is kept for
                        things that can't be undone — see ProfilePage. */}
                    <div className="ml-auto">
                      <Button type="button" size="sm" variant="secondary" onClick={() => unfriend(entry.friendshipId)}>
                        Unfriend
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
 
