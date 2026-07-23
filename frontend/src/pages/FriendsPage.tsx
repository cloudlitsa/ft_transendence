import { useEffect, useState } from "react"; // React hooks let us remember state and run code when the page first renders.
import { api } from "../lib/api";

// ---------- Types matching the backend responses ----------
interface FriendUser { // the user on the other side of a friendship. the backend sends this shape in both /friends and /friends/pending. interface means "the other user" in the friendship, not "me".
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface FriendEntry { // a single friendship row, either accepted or pending. the backend sends this shape in both /friends and /friends/pending.
  friendshipId: string;
  user: FriendUser;
}

interface PendingResponse { // the backend sends this shape from /friends/pending. it splits pending rows into incoming (I can accept) and outgoing (waiting). the "neutral" case where I already sent a request to the user
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

export default function FriendsPage() { // the main component for the /friends page. React calls this function to render the page. It returns JSX, which looks like HTML but can include dynamic values and components.
  // ---------- State: everything the page needs to remember ----------
  const [friends, setFriends] = useState<FriendEntry[]>([]); // the list of accepted friends. useState remembers this value across renders and gives us a function to update it. when we call setFriends, React re-renders the page with the new value.
  const [incoming, setIncoming] = useState<FriendEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([]);
  const [email, setEmail] = useState("");          // the add-friend input
  const [message, setMessage] = useState("");      // feedback after actions
  const [loading, setLoading] = useState(true); // true while we're waiting for the backend to respond. we show a "Loading…" message in this case.

  // ---------- Load everything from the backend ----------
  async function refresh() { // fetch friends and pending requests from the backend and update state. called once on page load, and after every action that changes the data. Async because it uses await to wait for the backend responses. We don't return anything; we just update state.
    // setLoading(true); // show the "Loading…" message while we wait for the backend. We don't clear the old data, so the user sees the old list until the new one arrives.
    // setMessage(""); // clear any old message
    try { // fetch both endpoints in parallel, then update state when both are done. Promise.all waits for both promises to resolve, and returns an array of results in the same order. If either promise rejects, Promise.all rejects immediately and we catch it below.
      const [friendsRes, pendingRes] = await Promise.all([
        api.get<{ friends: FriendEntry[] }>("/friends"), // the backend sends { friends: [...] } from /friends
        api.get<PendingResponse>("/friends/pending"), // the backend sends { incoming: [...], outgoing: [...] } from /friends/pending
      ]);
      setFriends(friendsRes.friends); // update state with the new data. React re-renders the page with the new values. friendsRes.friends is the array of accepted friends from the backend. pendingRes.incoming and pendingRes.outgoing are the arrays of incoming and outgoing pending requests.
      setIncoming(pendingRes.incoming);
      setOutgoing(pendingRes.outgoing);
    } catch (err) { // if either request fails, we catch the error here. err is the Error object thrown by api.get, which includes the backend's error message.
      setMessage((err as Error).message);
    } finally { // finally runs whether the try block succeeded or the catch block ran. we always want to stop showing "Loading…" when we're done, even if there was an error.
      setLoading(false);
    }
  }

  // Run refresh() once when the page first renders.
  useEffect(() => {
    refresh();
  }, []); // the empty array means "run this effect only once, on mount". if we left it out, React would run refresh() on every render, which would be bad.

  // ---------- Actions ----------
  async function sendRequest(e: React.FormEvent) { // called when the user submits the add-friend form. e is the event object, which we can use to prevent the default form submission behavior.
    e.preventDefault(); // stop the browser doing a full-page form submit
    try {
      const res = await api.post<{ message: string }>("/friends/request", { email }); // the backend sends { message: "..." } from /friends/request. we pass the email in the request body.
      setMessage(res.message);
      setEmail("");
      refresh(); // outgoing list may have a new entry
    } catch (err) {
      setMessage((err as Error).message); // show the backend's error message, e.g. "User not found" or "Already friends". we pickup message from the Error object thrown by api.post, which includes the backend's error message. we cast err to Error because TypeScript doesn't know what type it is.
    }
  }

  async function accept(id: string) {
    try {
      await api.post(`/friends/${id}/accept`);
      refresh(); // incoming list may have a new entry, and friends list may have a new entry. Refresh() fetches both lists from the backend and updates state, which triggers a re-render with the new data.
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function declineOrCancel(id: string) {
    try {
      await api.post(`/friends/${id}/decline`);
      refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function unfriend(id: string) {
    try {
      await api.delete(`/friends/${id}`);
      refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // ---------- Render ---------- It's JSX, which looks like HTML but can include dynamic values and components. React transforms this into JavaScript calls to create the DOM elements.
  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Friends</h1>

      {message && <p>{message}</p>}
   
      <section>
        <h2>Add a friend</h2>
        <form onSubmit={sendRequest}>
          <input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)} // update state when the user types in the input. React re-renders the page with the new value. e is the event object, which has a target property that is the input element. e.target.value is the current value of the input.
            required // HTML5 validation: the form won't submit if this input is empty or not a valid email address.
          />
          <button type="submit" >Send request</button>
        </form>
      </section>

      <section>
        <h2>Incoming requests</h2>
        {incoming.length === 0 && <p>None</p>}
        <ul>
          {incoming.map((entry) => (
            <li key={entry.friendshipId}>
              {entry.user.displayName} ({entry.user.email}){" "}
              <button onClick={() => accept(entry.friendshipId)}>Accept</button>{" "}
              <button onClick={() => declineOrCancel(entry.friendshipId)}>Decline</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Outgoing requests</h2>
        {outgoing.length === 0 && <p>None</p>}
        <ul>
          {outgoing.map((entry) => ( // the outgoing list is the requests I sent that are still pending. I can cancel them, but I can't accept or decline them because I'm the requester. map is a JavaScript array method that transforms each element of the array into a new value. In this case, we transform each FriendEntry into a <li> element with the user's display name and email, and a Cancel button that calls declineOrCancel with the friendshipId. React requires a unique key for each element in a list, so it can efficiently update the DOM when the list changes. We use friendshipId as the key because it's unique for each friendship.
            <li key={entry.friendshipId}>  
              {entry.user.displayName} ({entry.user.email}){" "}
              <button onClick={() => declineOrCancel(entry.friendshipId)}>Cancel</button>
            </li>
          ))}
        </ul>
      </section>

      <section> 
        <h2>My friends</h2>
        {friends.length === 0 && <p>No friends</p>}
        <ul>
          {friends.map((entry) => (
            <li key={entry.friendshipId}>
              {entry.user.displayName} ({entry.user.email}){" "} 
              <button onClick={() => unfriend(entry.friendshipId)}>Unfriend</button> 
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}