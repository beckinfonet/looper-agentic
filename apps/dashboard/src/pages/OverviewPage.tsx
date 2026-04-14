import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function OverviewPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState("");
  const [staffChoice, setStaffChoice] = useState<"required" | "optional" | "none">("optional");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getBusiness()
      .then((b) => {
        setName(b.name);
        setLocation(b.location);
        setContactInfo(b.contactInfo);
        setDescription(b.description ?? "");
        setTimezone(b.timezone ?? "");
        setStaffChoice(b.staffChoice ?? "optional");
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    try {
      await api.patchBusiness({
        name,
        location,
        contactInfo,
        description,
        timezone: timezone.trim() || undefined,
        staffChoice,
      });
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
          <label>IANA time zone</label>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/New_York"
          />
          <label>Customer staff selection</label>
          <select
            value={staffChoice}
            onChange={(e) => setStaffChoice(e.target.value as typeof staffChoice)}
          >
            <option value="optional">Optional — customer may pick a specialist</option>
            <option value="required">Required — customer must pick</option>
            <option value="none">None — any available staff</option>
          </select>
          <label>Description (search + bot)</label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you offer, policies, vibe…"
          />
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
