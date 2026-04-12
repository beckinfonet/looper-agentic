import { useEffect, useState } from "react";
import { api } from "../api";

export default function ServicesPage() {
  const [rows, setRows] = useState<
    { id: string; name: string; durationMinutes: number; priceCents: number }[]
  >([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    api.listServices().then(setRows).catch((e) => setErr((e as Error).message));
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createService({ name, durationMinutes: duration, priceCents: 0 });
      setName("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Services</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Minutes</th>
              <th>Price (¢)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.durationMinutes}</td>
                <td>{r.priceCents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Add service</h2>
        <form onSubmit={add}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Duration (minutes)</label>
          <input
            type="number"
            min={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
          {err && <p className="error">{err}</p>}
          <button type="submit">Add</button>
        </form>
      </div>
    </div>
  );
}
