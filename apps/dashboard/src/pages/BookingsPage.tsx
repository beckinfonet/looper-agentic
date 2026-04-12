import { useEffect, useState } from "react";
import { api } from "../api";

type Row = {
  id: string;
  time: string;
  status: string;
  serviceName: string | null;
  userId: string;
};

export default function BookingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    api.listBookings().then(setRows).catch((e) => setErr((e as Error).message));
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    setErr(null);
    try {
      await api.patchBooking(id, { status });
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h1>Bookings</h1>
      {err && <p className="error">{err}</p>}
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Service</th>
            <th>User</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.time).toLocaleString()}</td>
              <td>{r.serviceName}</td>
              <td>{r.userId}</td>
              <td>{r.status}</td>
              <td className="row">
                {r.status === "pending" && (
                  <>
                    <button type="button" onClick={() => setStatus(r.id, "confirmed")}>
                      Confirm
                    </button>
                    <button type="button" className="danger" onClick={() => setStatus(r.id, "cancelled")}>
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
