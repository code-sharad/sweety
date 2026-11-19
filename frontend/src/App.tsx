import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, message, type User } from "./api";
import Tracker from "./Tracker";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    api<User>("auth/me")
      .then((u) => {
        if (active) setUser(u);
      })
      .catch((e) => {
        if (active && !(e instanceof ApiError && e.status === 401))
          setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (signup) {
        await api("auth/register", "POST", fields);
        setSignup(false);
        setVisible(false);
        setNotice("Account created. Sign in to open your logbook.");
      } else setUser(await api<User>("auth/login", "POST", fields));
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    setPending(true);
    setError("");
    try {
      await api("auth/logout", "POST");
      setUser(null);
      setNotice("");
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="mast">
        <strong className="brand">
          <i aria-hidden="true" />
          Sweety
        </strong>
        {user ? (
          <div className="account">
            <span>{user.name}</span>
            <button disabled={pending} onClick={logout}>
              Sign out
            </button>
          </div>
        ) : (
          <span className="mast-note">Personal glucose journal</span>
        )}
      </header>
      {loading ? (
        <main role="status">Opening your logbook…</main>
      ) : user ? (
        <main>
          {error && <p role="alert">{error}</p>}
          <Tracker
            key={user.id}
            onExpired={() => {
              setUser(null);
              setNotice("Your session expired. Please sign in again.");
            }}
          />
        </main>
      ) : (
        <main className="auth">
          <section className="authform">
            <h1>{signup ? "Create an account" : "Welcome back."}</h1>
            <p>
              {signup
                ? "Start your personal glucose logbook."
                : "Sign in to your glucose journal."}
            </p>
            <form key={String(signup)} onSubmit={submit}>
              {signup && (
                <label>
                  Name
                  <input name="name" autoComplete="name" required />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <div className="password-group">
                <label htmlFor="auth-password">Password</label>
                <span className="password-field">
                  <input
                    id="auth-password"
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete={signup ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Hide" : "Show"}
                  </button>
                </span>
              </div>
              {error && <p role="alert">{error}</p>}
              {notice && <p role="status">{notice}</p>}
              <button className="primary" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : signup
                    ? "Create account"
                    : "Sign in"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </form>
            <p>
              {signup ? "Already have an account?" : "New to Sweety?"}{" "}
              <button
                className="link"
                disabled={pending}
                onClick={() => {
                  setSignup(!signup);
                  setVisible(false);
                  setError("");
                  setNotice("");
                }}
              >
                {signup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </section>
          <aside className="cover" aria-label="Journal cover">
            <img
              src="/journal-cover.webp"
              alt="Burgundy Sweety notebook beside a glucose meter and a tangerine."
            />
            <p>Your daily logbook.</p>
          </aside>
        </main>
      )}
    </>
  );
}
