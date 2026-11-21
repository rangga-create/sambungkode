import { auth } from "./firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = auth?.currentUser;
  const token = user ? await user.getIdToken() : null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Tidak bisa terhubung ke server API. Pastikan backend berjalan di http://localhost:4000");
  }

  const payload = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new ApiError(response.status, payload.message ?? `Permintaan gagal (HTTP ${response.status}).`);
  }

  return payload as T;
}
