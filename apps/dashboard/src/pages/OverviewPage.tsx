import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function OverviewPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getBusiness()
      .then((b) => {
        setName(b.name);
        setLocation(b.location);
        setContactInfo(b.contactInfo);
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    try {
      await api.patchBusiness({ name, location, contactInfo });
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Business profile</h1>
        <form onSubmit={save}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} required />
          <label>Contact</label>
          <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          {err && <p className="error">{err}</p>}
          {saved && <p>Saved.</p>}
          <button type="submit">Save</button>
        </form>
      </div>
      <button
        className="secondary"
        type="button"
        onClick={() => {
          setToken(null);
          nav("/login");
        }}
      >
        Log out
      </button>
    </div>
  );
}
