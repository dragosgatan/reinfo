"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
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

const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalid"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    try {
      await api.post("/api/auth/forgot-password", values);
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : t("errorGeneric");
      toast.error(message || t("errorGeneric"));
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

        {submitted ? (
          <p className="text-sm text-muted-foreground">{t("success")}</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tu@exemplu.ro"
                        autoComplete="email"
                        {...field}
                      />
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
