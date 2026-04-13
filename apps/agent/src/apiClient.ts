import { config } from "./config.js";

const jsonHeaders = {
  "Content-Type": "application/json",
  "X-Internal-Key": config.internalKey,
};

const getHeaders = {
  "X-Internal-Key": config.internalKey,
};

function wrapFetchError(path: string, e: unknown): Error {
  const base = `${config.apiBase}${path}`;
  if (e instanceof TypeError && String(e.message).includes("fetch")) {
    return new Error(
      `fetch failed (${base}). Set API_BASE_URL to your API’s public https URL on Railway; ` +
        `AGENT_INTERNAL_KEY must match the API. Original: ${e.message}`,
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${config.apiBase}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw wrapFetchError(path, e);
  }
  const text = await res.text();
  let data: { error?: string } | null = null;
  try {
    data = text ? (JSON.parse(text) as { error?: string }) : null;
  } catch {
    throw new Error(res.ok ? "Invalid JSON from API" : `${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data?.error ?? res.statusText);
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${config.apiBase}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders });
  } catch (e) {
    throw wrapFetchError(path, e);
  }
  const text = await res.text();
  let data: { error?: string } | null = null;
  try {
    data = text ? (JSON.parse(text) as { error?: string }) : null;
  } catch {
    throw new Error(res.ok ? "Invalid JSON from API" : `${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data?.error ?? res.statusText);
  return data as T;
}
