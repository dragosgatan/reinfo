"use client";

import { useState } from "react";
import { Swords } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { DuelRequestReadSchema } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const TIME_VALUES = [15, 30, 45, 60];

const DIFFICULTY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface ChallengeButtonProps {
  targetUsername: string;
}

export function ChallengeButton({ targetUsername }: ChallengeButtonProps) {
  const t = useTranslations("duel");
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [diffMin, setDiffMin] = useState(3);
  const [diffMax, setDiffMax] = useState(7);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated || user?.username === targetUsername) return null;

  function getDifficultyLabel(value: number): string {
    if (value === 1) return `1 (${t("diffEasy")})`;
    if (value === 5) return `5 (${t("diffMedium")})`;
    if (value === 10) return `10 (${t("diffExpert")})`;
    return String(value);
  }

  const handleChallenge = async () => {
    setLoading(true);
    try {
      await api.post(
        "/api/duels/requests",
        {
          to_username: targetUsername,
          time_limit_minutes: timeLimit,
          difficulty_min: diffMin,
          difficulty_max: diffMax,
        },
        DuelRequestReadSchema,
      );
      toast.success(t("challengeSent", { username: targetUsername }));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("challengeError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Swords className="h-3.5 w-3.5" />
        {t("challengeBtn")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("challengeTitle")}</DialogTitle>
            <DialogDescription>
              {t("challengeDesc", { username: targetUsername })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("timeLimitLabel")}</Label>
              <Select
                value={String(timeLimit)}
                onValueChange={(v) => setTimeLimit(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_VALUES.map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v} {t("minutes")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("diffMinLabel")}</Label>
                <Select
                  value={String(diffMin)}
                  onValueChange={(v) => setDiffMin(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_VALUES.filter((v) => v <= diffMax).map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {getDifficultyLabel(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("diffMaxLabel")}</Label>
                <Select
                  value={String(diffMax)}
                  onValueChange={(v) => setDiffMax(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_VALUES.filter((v) => v >= diffMin).map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {getDifficultyLabel(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancelBtn")}
            </Button>
            <Button onClick={handleChallenge} disabled={loading}>
              {loading ? t("sending") : t("sendChallenge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
