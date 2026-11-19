import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, message, type User } from "./api";
import Tracker from "./Tracker";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState(false);
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
          <span>Blood glucose tracker</span>
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
          <aside className="cover">
            <span>Blood glucose journal</span>
            <h1>
              Your daily
              <br />
              <em>logbook.</em>
            </h1>
            <div className="rings" aria-hidden="true" />
          </aside>
          <section className="authform">
            <h2>{signup ? "Create an account" : "Welcome back"}</h2>
            <p>
              {signup
                ? "Start your personal glucose logbook."
                : "Sign in to record and review your readings."}
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
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                />
              </label>
              {error && <p role="alert">{error}</p>}
              {notice && <p role="status">{notice}</p>}
              <button className="primary" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : signup
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <p>
              {signup ? "Already have an account?" : "New to Sweety?"}{" "}
              <button
                className="link"
                disabled={pending}
                onClick={() => {
                  setSignup(!signup);
                  setError("");
                  setNotice("");
                }}
              >
                {signup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </section>
        </main>
      )}
    </>
  );
}
