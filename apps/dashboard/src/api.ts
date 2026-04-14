const TOKEN_KEY = "looper_business_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error ?? res.statusText);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; businessId: string }>("/v1/business-auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    }),
  register: (body: {
    email: string;
    password: string;
    businessName: string;
    type: "restaurant" | "spa" | "barbershop";
    location: string;
    timezone: string;
    description?: string;
    staffChoice?: "required" | "optional" | "none";
  }) =>
    req<{ token: string; business: { id: string; name: string } }>("/v1/business-auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      auth: false,
    }),
  getBusiness: () =>
    req<{
      id: string;
      name: string;
      type: string;
      location: string;
      description: string;
      contactInfo: string;
      hours: { dayOfWeek: number; open: string; close: string }[];
      timezone: string;
      staffChoice: "required" | "optional" | "none";
    }>("/v1/business/me"),
  patchBusiness: (patch: Record<string, unknown>) =>
    req<unknown>("/v1/business/me", { method: "PATCH", body: JSON.stringify(patch) }),
  listServices: () =>
    req<{ id: string; name: string; durationMinutes: number; priceCents: number }[]>(
      "/v1/business/services"
    ),
  createService: (body: { name: string; durationMinutes: number; priceCents?: number }) =>
    req<unknown>("/v1/business/services", { method: "POST", body: JSON.stringify(body) }),
  listSpecialists: () => req<unknown[]>("/v1/business/specialists"),
  createSpecialist: (body: { name: string; role: string }) =>
    req<unknown>("/v1/business/specialists", { method: "POST", body: JSON.stringify(body) }),
  putAvailability: (body: { date: string; specialistId?: string | null; slots: string[] }) =>
    req<unknown>("/v1/business/availability", { method: "PUT", body: JSON.stringify(body) }),
  listBookings: () =>
    req<
      {
        id: string;
        time: string;
        status: string;
        businessName: string | null;
        serviceName: string | null;
        userId: string;
      }[]
    >("/v1/business/bookings"),
  patchBooking: (id: string, body: { status: string }) =>
    req<unknown>(`/v1/business/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
