import { useEffect, useState } from "react";
import { api } from "../api";

type Spec = { _id: string; name: string; role: string };

export default function SpecialistsPage() {
  const [rows, setRows] = useState<Spec[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function load() {
    api
      .listSpecialists()
      .then((r) => setRows(r as Spec[]))
      .catch((e) => setErr((e as Error).message));
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createSpecialist({ name, role });
      setName("");
      setRole("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Specialists</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.name}</td>
                <td>{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Add specialist</h2>
        <form onSubmit={add}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Role / service type</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} required />
          {err && <p className="error">{err}</p>}
          <button type="submit">Add</button>
        </form>
      </div>
    </div>
  );
}
