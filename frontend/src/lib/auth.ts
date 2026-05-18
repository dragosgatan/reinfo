"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api, ApiError } from "./api";

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string(),
  role: z.enum(["student", "teacher", "admin"]),
  created_at: z.string(),
  avatar_url: z.string().nullable().optional(),
  display_name: z.string().optional(),
  bio: z.string().nullable().optional(),
  language: z.string().optional(),
  privacy_show_email: z.boolean().optional(),
  privacy_show_activity: z.boolean().optional(),
  privacy_show_solved: z.boolean().optional(),
});

export type User = z.infer<typeof UserSchema>;

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/api/auth/me", UserSchema),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data ?? null,
    isLoading,
    isAuthenticated: !!data,
    error,
  };
}
