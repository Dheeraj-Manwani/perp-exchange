"use client";

import * as React from "react";
import { api, getToken, setToken } from "@/lib/api";

interface AuthState {
  username: string | null;
  isAuthenticated: boolean;
  ready: boolean;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

const USER_KEY = "perpex.username";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [authOpen, setAuthOpen] = React.useState(false);

  React.useEffect(() => {
    const token = getToken();
    const storedUser =
      typeof window !== "undefined"
        ? window.localStorage.getItem(USER_KEY)
        : null;
    if (token) setUsername(storedUser ?? "trader");
    setReady(true);
  }, []);

  const persistUser = React.useCallback((name: string) => {
    setUsername(name);
    if (typeof window !== "undefined")
      window.localStorage.setItem(USER_KEY, name);
  }, []);

  const signIn = React.useCallback(
    async (u: string, p: string) => {
      const { token } = await api.signin(u, p);
      setToken(token);
      persistUser(u);
      setAuthOpen(false);
    },
    [persistUser],
  );

  const signUp = React.useCallback(
    async (u: string, p: string) => {
      const { token } = await api.signup(u, p);
      setToken(token);
      persistUser(u);
      setAuthOpen(false);
    },
    [persistUser],
  );

  const signOut = React.useCallback(() => {
    setToken(null);
    setUsername(null);
    if (typeof window !== "undefined")
      window.localStorage.removeItem(USER_KEY);
  }, []);

  const value: AuthState = {
    username,
    isAuthenticated: !!username,
    ready,
    authOpen,
    setAuthOpen,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
