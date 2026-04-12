import { config } from "./config.js";

const headers = {
  "Content-Type": "application/json",
  "X-Internal-Key": config.internalKey,
};

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? res.statusText);
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, { headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? res.statusText);
  return data as T;
}
