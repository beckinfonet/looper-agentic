import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function RegisterPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<"restaurant" | "spa" | "barbershop">("restaurant");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.register({ email, password, businessName, location, type });
      setToken(r.token);
      nav("/");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h1>Register business</h1>
      <form onSubmit={onSubmit}>
        <label>Business name</label>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="restaurant">Restaurant</option>
          <option value="spa">Spa</option>
          <option value="barbershop">Barbershop</option>
        </select>
        <label>Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} required />
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          minLength={6}
          required
        />
        {err && <p className="error">{err}</p>}
        <button type="submit">Create</button>
      </form>
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
