"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export function DepositDialog({
  trigger,
  onDeposited,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  onDeposited?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setUncontrolledOpen(v);
    onOpenChange?.(v);
  };
  const [amount, setAmount] = React.useState("1000");
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setLoading(true);
    try {
      // amount is a scaled integer (USDC, decimals = 2)
      await api.onRamp(Math.round(value * 100).toString());
      toast.success(`Deposited ${value.toLocaleString()} USDC`);
      setOpen(false);
      onDeposited?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit funds</DialogTitle>
          <DialogDescription>
            Test on-ramp — credits your account with simulated USDC.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-1.5 mt-1">
              {[100, 1000, 10000].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(String(v))}
                >
                  {v.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "Processing…" : "Deposit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
