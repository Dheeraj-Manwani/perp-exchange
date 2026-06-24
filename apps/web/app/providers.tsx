"use client";

import * as React from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthDialog />
      <Toaster />
    </AuthProvider>
  );
}
