"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { api, ApiError } from "@/lib/api";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Minimum 8 caractere"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Parolele nu se potrivesc",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    try {
      await api.post("/api/auth/reset-password", {
        token,
        password: values.password,
      });
      setSuccess(true);
      toast.success(t("success"));
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 400
          ? t("errorInvalidToken")
          : t("errorGeneric");
      toast.error(message);
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="mb-3 font-mono text-xs text-muted-foreground">{"// resetare parolă"}</p>
          <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {success ? (
          <p className="text-sm text-muted-foreground">{t("success")}</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("password")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {t("submit")}
              </Button>
            </form>
          </Form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
