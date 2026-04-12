import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.login(email, password);
      setToken(r.token);
      nav("/");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h1>Business login</h1>
      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
        {err && <p className="error">{err}</p>}
        <button type="submit">Sign in</button>
      </form>
      <p>
        <Link to="/register">Create business account</Link>
      </p>
    </div>
  );
}
