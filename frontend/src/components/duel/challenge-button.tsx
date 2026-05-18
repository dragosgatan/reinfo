"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { toast } from "sonner";
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

const TIME_OPTIONS = [
  { label: "15 minute", value: 15 },
  { label: "30 minute", value: 30 },
  { label: "45 minute", value: 45 },
  { label: "60 minute", value: 60 },
];

const DIFFICULTY_OPTIONS = [
  { label: "1 (Ușor)", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5 (Mediu)", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10 (Expert)", value: 10 },
];

interface ChallengeButtonProps {
  targetUsername: string;
}

export function ChallengeButton({ targetUsername }: ChallengeButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [diffMin, setDiffMin] = useState(3);
  const [diffMax, setDiffMax] = useState(7);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated || user?.username === targetUsername) return null;

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
      toast.success(`Provocare trimisă lui ${targetUsername}!`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare la trimitere");
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
        Provoacă la duel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provoacă la duel</DialogTitle>
            <DialogDescription>
              Trimite o provocare lui <span className="font-mono font-semibold">{targetUsername}</span>.
              Dacă acceptă, veți primi amândoi o problemă aleatorie din dificultatea aleasă.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Limită de timp</Label>
              <Select
                value={String(timeLimit)}
                onValueChange={(v) => setTimeLimit(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dificultate min</Label>
                <Select
                  value={String(diffMin)}
                  onValueChange={(v) => setDiffMin(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.filter((o) => o.value <= diffMax).map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dificultate max</Label>
                <Select
                  value={String(diffMax)}
                  onValueChange={(v) => setDiffMax(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.filter((o) => o.value >= diffMin).map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anulează
            </Button>
            <Button onClick={handleChallenge} disabled={loading}>
              {loading ? "Se trimite..." : "Trimite provocarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
