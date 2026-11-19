import { useState, type FormEvent } from "react";
import "./App.css";

export default function App() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      if (response.status === 201) {
        setCreated(true);
      } else {
        const data = await response.json();
        setError(data.message || "Could not create your account. Please try again.");
      }
    } catch {
      setError("Could not complete signup. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <header>Sweety <span>Blood glucose tracker</span></header>
      <section>
        <h1>{created ? "Account created" : "Create your account"}</h1>
        {created ? <p role="status">Your registration is complete.</p> : (
          <form onSubmit={register}>
            <label>Name<input name="name" autoComplete="name" required /></label>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
            <label>Password<input name="password" type="password" autoComplete="new-password" required /></label>
            {error && <p role="alert">{error}</p>}
            <button disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
