import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`[${status}] ${detail}`);
    this.name = "ApiError";
  }
}

interface RequestOptions<T> extends Omit<RequestInit, "body"> {
  schema?: z.ZodType<T>;
  body?: unknown;
}

async function request<T = unknown>(
  path: string,
  { schema, body, ...init }: RequestOptions<T> = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (payload as { detail?: string }).detail ?? response.statusText,
    );
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json();
  return schema ? schema.parse(data) : (data as T);
}

export const api = {
  get<T = unknown>(path: string, schema?: z.ZodType<T>) {
    return request<T>(path, { method: "GET", schema });
  },

  post<T = unknown>(path: string, body: unknown, schema?: z.ZodType<T>) {
    return request<T>(path, { method: "POST", body, schema });
  },

  put<T = unknown>(path: string, body: unknown, schema?: z.ZodType<T>) {
    return request<T>(path, { method: "PUT", body, schema });
  },

  patch<T = unknown>(path: string, body: unknown, schema?: z.ZodType<T>) {
    return request<T>(path, { method: "PATCH", body, schema });
  },

  delete<T = unknown>(path: string, schema?: z.ZodType<T>) {
    return request<T>(path, { method: "DELETE", schema });
  },
};
