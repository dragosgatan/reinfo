"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ContestDetailSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

type ContestType = "competition" | "class_test";

const TYPE_OPTIONS: { value: ContestType; label: string; description: string }[] = [
  {
    value: "competition",
    label: "Concurs",
    description: "Clasament public, participare liberă",
  },
  {
    value: "class_test",
    label: "Test de clasă",
    description: "Clasament ascuns elevilor în timpul testului",
  },
];

export default function NouConcursPage() {
  const t = useTranslations("contests");
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [contestType, setContestType] = useState<ContestType>("competition");
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return null;

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Permisiuni insuficiente.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (new Date(endTime) <= new Date(startTime)) {
      toast.error(t("create.errorEndBeforeStart"));
      return;
    }
    setSubmitting(true);
    try {
      const contest = await api.post(
        "/api/contests/",
        {
          title,
          description_md: description || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          contest_type: contestType,
          scoring_mode: contestType === "class_test" ? "test" : "sum",
        },
        ContestDetailSchema,
      );
      router.push(`/concursuri/${contest.slug}`);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : t("create.errorGeneric");
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/concursuri" className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToContests")}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("create.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Tip</Label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setContestType(opt.value)}
                className={[
                  "rounded border px-3 py-3 text-left transition-colors",
                  contestType === opt.value
                    ? "border-foreground bg-foreground/5"
                    : "border-input hover:border-foreground/40",
                ].join(" ")}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">{t("create.name")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={contestType === "class_test" ? "Test clasa a IX-a A" : "Olimpiadă județeană"}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">{t("create.description")}</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={4}
            placeholder="Descriere opțională în Markdown..."
            className="flex min-h-[80px] w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start">{t("create.startTime")}</Label>
            <Input
              id="start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">{t("create.endTime")}</Label>
            <Input
              id="end"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Se salvează..." : t("create.save")}
        </Button>
      </form>
    </div>
  );
}
