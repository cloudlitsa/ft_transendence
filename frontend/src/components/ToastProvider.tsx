import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// A toast has a kind (colour/meaning) and a message. The id lets us track and
// remove each one individually.
type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

// This is what any component gets when it calls useToast(): three functions to
// fire a toast of each kind.
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ---------- The Context ----------
// createContext makes a "channel" that a Provider fills and any child can read.
// It starts as null; useToast() below guards against reading it outside a Provider.
const ToastContext = createContext<ToastApi | null>(null);

// ---------- The hook components use ----------
// Instead of importing the context directly everywhere, components call
// useToast(). It returns the { success, error, info } API from the nearest
// ToastProvider above it in the tree.
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // If this throws, someone used useToast() outside <ToastProvider>. Failing
    // loudly here is better than a confusing "cannot read property" later.
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

// A module-level counter for unique ids. Simple and good enough — each toast
// just needs an id different from the others currently on screen.
let nextId = 0;

// ---------- The Provider ----------
// Wraps the app. It owns the list of active toasts and hands the "fire a toast"
// functions down through context. It also renders the toasts on screen.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Remove a toast by id. useCallback keeps the same function identity between
  // renders (tidy, and avoids re-creating it needlessly).
  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // Add a toast, then schedule its automatic removal after 3 seconds.
  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, type, message }]);
      setTimeout(() => remove(id), 3000);
    },
    [remove]
  );

  // The API we expose to the rest of the app.
  const api: ToastApi = {
    success: (message) => add("success", message),
    error: (message) => add("error", message),
    info: (message) => add("info", message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The visual layer sits alongside the app, fixed to the corner. */}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

// ---------- The visual layer ----------
// Renders the current toasts stacked in the top-right corner. Clicking one
// dismisses it early.
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const colours: Record<ToastType, string> = {
    success: "#16a34a", // green
    error: "#b91c1c", // red
    info: "#4f46e5", // indigo
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 1000, // sit above everything else
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status" // announced by screen readers
          onClick={() => onDismiss(t.id)}
          style={{
            background: colours[t.type],
            color: "white",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            cursor: "pointer",
            minWidth: 220,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            fontSize: "0.9rem",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
