import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, message, type User } from "./api";

type SharedDoctor = Pick<User, "id" | "name" | "email">;

export default function ReportSharing({
  onExpired,
}: {
  onExpired: () => void;
}) {
  const [doctors, setDoctors] = useState<SharedDoctor[] | null>(null);
  const [email, setEmail] = useState("");
  const [candidate, setCandidate] = useState<SharedDoctor | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, retry] = useState(0);

  useEffect(() => {
    let active = true;
    api<SharedDoctor[]>("report-sharing")
      .then((result) => {
        if (active) setDoctors(result);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) onExpired();
        else setLoadError(message(e));
      });
    return () => {
      active = false;
    };
  }, [attempt, onExpired]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpired();
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function findDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCandidate(null);
    void runAction(async () => {
      const doctor = await api<SharedDoctor>("report-sharing/lookup", "POST", {
        email,
      });
      if (doctors?.some(({ id }) => id === doctor.id)) {
        setNotice(`You already share reports with ${doctor.name}.`);
        return;
      }
      setCandidate(doctor);
    });
  }

  function shareWith(doctor: SharedDoctor) {
    void runAction(async () => {
      const shared = await api<SharedDoctor>(
        `report-sharing/${doctor.id}`,
        "PUT",
      );
      setDoctors((current) => [
        ...(current ?? []).filter(({ id }) => id !== shared.id),
        shared,
      ]);
      setCandidate(null);
      setEmail("");
      setNotice(`Reports shared with ${shared.name}.`);
    });
  }

  function revoke(doctor: SharedDoctor) {
    void runAction(async () => {
      await api(`report-sharing/${doctor.id}`, "DELETE");
      setDoctors((current) =>
        (current ?? []).filter(({ id }) => id !== doctor.id),
      );
      setNotice(`Report access revoked for ${doctor.name}.`);
    });
  }

  if (loadError) {
    return (
      <div role="alert">
        {loadError}{" "}
        <button
          onClick={() => {
            setLoadError("");
            retry((n) => n + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!doctors) return <p role="status">Loading report sharing…</p>;

  return (
    <div className="report-sharing">
      <p>
        Give a doctor read-only access to all your glucose reports. You can
        revoke access at any time.
      </p>
      <form onSubmit={findDoctor}>
        <label>
          Doctor’s email
          <input
            type="email"
            autoComplete="off"
            required
            value={email}
            disabled={busy}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setCandidate(null);
            }}
          />
        </label>
        <button disabled={busy}>Find doctor</button>
      </form>
      {candidate && (
        <section className="share-confirm" aria-label="Confirm report sharing">
          <div>
            <strong>{candidate.name}</strong>
            <p>{candidate.email}</p>
          </div>
          <div className="actions">
            <button disabled={busy} onClick={() => setCandidate(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => shareWith(candidate)}
            >
              Confirm sharing
            </button>
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section
        className="shared-doctors"
        aria-labelledby="shared-doctors-heading"
      >
        <h2 id="shared-doctors-heading">Shared with</h2>
        {doctors.length ? (
          <ul>
            {doctors.map((doctor) => (
              <li key={doctor.id}>
                <div>
                  <strong>{doctor.name}</strong>
                  <p>{doctor.email}</p>
                </div>
                <button
                  aria-label={`Revoke access for ${doctor.name} (${doctor.email})`}
                  disabled={busy}
                  onClick={() => revoke(doctor)}
                >
                  Revoke access
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>You haven’t shared your reports with any doctors.</p>
        )}
      </section>
    </div>
  );
}
