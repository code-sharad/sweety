export type User = { id: number; name: string; email: string };

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.message || "Could not reach Sweety. Please try again.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}
