import { useState } from "react";
import { api } from "../api";

export default function AvailabilityPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotsText, setSlotsText] = useState("19:30\n20:00");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const parts = slotsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const slots = parts.map((t) => {
      const iso = new Date(`${date}T${t}:00.000Z`);
      if (Number.isNaN(iso.getTime())) throw new Error(`Bad time: ${t}`);
      return iso.toISOString();
    });
    try {
      await api.putAvailability({ date, slots });
      setOk("Availability saved.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h1>Availability</h1>
      <p>
        Enter times in 24h format (local interpreted as UTC for this MVP). One per line, e.g.{" "}
        <code>19:30</code>.
      </p>
      <form onSubmit={save}>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <label>Time slots</label>
        <textarea rows={6} value={slotsText} onChange={(e) => setSlotsText(e.target.value)} />
        {err && <p className="error">{err}</p>}
        {ok && <p>{ok}</p>}
        <button type="submit">Save slots</button>
      </form>
    </div>
  );
}
