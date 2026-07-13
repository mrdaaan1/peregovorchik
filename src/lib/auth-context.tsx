"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type AuthStatus = "loading" | "signed-out" | "signed-in";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  supabase: SupabaseClient;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function loadProfile(currentUser: User) {
    const { data } = await supabase
      .from("profiles")
      .select("id, auth_user_id, email, display_name, created_at")
      .eq("auth_user_id", currentUser.id)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user);
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser);
        setStatus("signed-in");
      } else {
        setStatus("signed-out");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user);
        setStatus("signed-in");
      } else {
        setProfile(null);
        setStatus("signed-out");
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, profile, supabase, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
