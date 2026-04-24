import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { loadCurrentUserProfile, setApiAccessTokenResolver } from "../api/client";
import { HAS_SUPABASE_AUTH_CONFIG } from "../config";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../types";

interface AuthCredentials {
  email: string;
  password: string;
  username?: string;
}

interface AuthContextValue {
  authUser: User | null;
  error: string | null;
  isConfigured: boolean;
  isReady: boolean;
  profile: AppUser | null;
  refreshProfile: () => Promise<AppUser | null>;
  session: Session | null;
  signInWithPassword: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUpWithPassword: (credentials: AuthCredentials) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildConfigurationError = () =>
  new Error("Supabase Auth ainda não está configurado no app.");

const syncAccessToken = (session: Session | null) => {
  setApiAccessTokenResolver(() => session?.access_token ?? null);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(!HAS_SUPABASE_AUTH_CONFIG);
  const [error, setError] = useState<string | null>(null);

  const applySession = (nextSession: Session | null) => {
    setSession(nextSession);
    setAuthUser(nextSession?.user ?? null);
    syncAccessToken(nextSession);
  };

  const refreshProfile = async () => {
    if (!supabase) {
      setProfile(null);
      return null;
    }

    try {
      const currentProfile = await loadCurrentUserProfile();
      setProfile(currentProfile);
      setError(null);
      return currentProfile;
    } catch (nextError) {
      setProfile(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível sincronizar a sessão com a API."
      );
      return null;
    }
  };

  useEffect(() => {
    const client = supabase;

    if (!client) {
      syncAccessToken(null);
      setIsReady(true);
      return;
    }

    let active = true;

    const boot = async () => {
      const { data, error: sessionError } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      const nextSession = data.session ?? null;
      applySession(nextSession);

      if (nextSession) {
        await refreshProfile();
      } else {
        setProfile(null);
      }

      if (active) {
        setIsReady(true);
      }
    };

    void boot();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);

      if (nextSession) {
        void refreshProfile();
      } else {
        setProfile(null);
        setError(null);
      }

      setIsReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async ({ email, password }: AuthCredentials) => {
    if (!supabase) {
      throw buildConfigurationError();
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      throw signInError;
    }

    applySession(data.session);
    await refreshProfile();
  };

  const signUpWithPassword = async ({ email, password, username }: AuthCredentials) => {
    if (!supabase) {
      throw buildConfigurationError();
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: username
        ? {
            data: {
              username
            }
          }
        : undefined
    });

    if (signUpError) {
      throw signUpError;
    }

    applySession(data.session ?? null);

    if (data.session) {
      await refreshProfile();
      return;
    }

    setProfile(null);
  };

  const signOut = async () => {
    if (!supabase) {
      setProfile(null);
      syncAccessToken(null);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw signOutError;
    }

    applySession(null);
    setProfile(null);
    setError(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      error,
      isConfigured: HAS_SUPABASE_AUTH_CONFIG,
      isReady,
      profile,
      refreshProfile,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword
    }),
    [authUser, error, isReady, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider.");
  }

  return context;
};
