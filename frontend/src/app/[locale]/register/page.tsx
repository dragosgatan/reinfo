"use client";

import { useTranslations, useLocale } from "next-intl";
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

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Minimum 3 caractere")
      .max(20, "Maximum 20 de caractere")
      .regex(/^[a-zA-Z0-9_]+$/, "Doar litere, cifre și _"),
    display_name: z.string().min(1, "Obligatoriu").max(128, "Maximum 128 de caractere"),
    email: z.string().email("Email invalid"),
    password: z.string().min(8, "Minimum 8 caractere"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Parolele nu se potrivesc",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const t = useTranslations("register");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const locale = useLocale();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", display_name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterValues) {
    try {
      await api.post("/api/auth/register", {
        username: values.username,
        display_name: values.display_name,
        email: values.email,
        password: values.password,
        language: locale,
      });
      router.push("/login");
      toast.success(t("success"));
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? t("errorConflict")
          : t("errorGeneric");
      toast.error(message);
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
      <div className="mb-6">
        <p className="mb-3 font-mono text-xs text-muted-foreground">{"// înregistrare"}</p>
        <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("username")}</FormLabel>
                <FormControl>
                  <Input placeholder="ion_popescu" autoComplete="username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="display_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("displayName")}</FormLabel>
                <FormControl>
                  <Input placeholder="Ion Popescu" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="tu@exemplu.ro" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
            {isSubmitting ? tAuth("registering") : t("submit")}
          </Button>
        </form>
      </Form>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t("terms")}</p>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-foreground transition-colors hover:text-primary"
        >
          {t("login")}
        </Link>
      </p>
      </div>
    </div>
  );
}
