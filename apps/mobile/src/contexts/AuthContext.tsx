import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

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

const PROFILE_CACHE_KEY_PREFIX = "lore.auth.profile";

const getCachedProfileKey = (userId: string) => `${PROFILE_CACHE_KEY_PREFIX}.${userId}`;

const readCachedProfile = async (userId: string) => {
  try {
    const cacheKey = getCachedProfileKey(userId);
    const cachedValue =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(cacheKey) ?? null
        : await SecureStore.getItemAsync(cacheKey);

    if (!cachedValue) {
      return null;
    }

    const cachedProfile = JSON.parse(cachedValue) as AppUser;
    return cachedProfile.id === userId ? cachedProfile : null;
  } catch {
    return null;
  }
};

const writeCachedProfile = async (nextProfile: AppUser) => {
  try {
    const cacheKey = getCachedProfileKey(nextProfile.id);
    const serializedProfile = JSON.stringify(nextProfile);

    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(cacheKey, serializedProfile);
      return;
    }

    await SecureStore.setItemAsync(cacheKey, serializedProfile, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  } catch {}
};

const clearCachedProfile = async (userId: string) => {
  try {
    const cacheKey = getCachedProfileKey(userId);

    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(cacheKey);
      return;
    }

    await SecureStore.deleteItemAsync(cacheKey);
  } catch {}
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

  const refreshProfile = async (options?: { preserveCurrentProfile?: boolean }) => {
    if (!supabase) {
      setProfile(null);
      return null;
    }

    try {
      const currentProfile = await loadCurrentUserProfile();
      setProfile(currentProfile);
      setError(null);
      void writeCachedProfile(currentProfile);
      return currentProfile;
    } catch (nextError) {
      if (!options?.preserveCurrentProfile) {
        setProfile(null);
      }
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
        setProfile((current) => (current?.id === nextSession.user.id ? current : null));

        const cachedProfile = await readCachedProfile(nextSession.user.id);

        if (!active) {
          return;
        }

        if (cachedProfile) {
          setProfile(cachedProfile);
          setError(null);
        }

        setIsReady(true);
        void refreshProfile({ preserveCurrentProfile: true });
      } else {
        setProfile(null);
        setIsReady(true);
      }
    };

    void boot();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);

      if (nextSession) {
        setProfile((current) => (current?.id === nextSession.user.id ? current : null));

        void (async () => {
          const cachedProfile = await readCachedProfile(nextSession.user.id);

          if (!active) {
            return;
          }

          if (cachedProfile) {
            setProfile(cachedProfile);
            setError(null);
          }

          await refreshProfile({ preserveCurrentProfile: true });
        })();
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
    setProfile(null);
    await refreshProfile({ preserveCurrentProfile: false });
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
      setProfile(null);
      await refreshProfile({ preserveCurrentProfile: false });
      return;
    }

    setProfile(null);
  };

  const signOut = async () => {
    const currentUserId = authUser?.id;

    if (!supabase) {
      setProfile(null);
      syncAccessToken(null);
      if (currentUserId) {
        void clearCachedProfile(currentUserId);
      }
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw signOutError;
    }

    applySession(null);
    setProfile(null);
    setError(null);
    if (currentUserId) {
      void clearCachedProfile(currentUserId);
    }
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
    [
      authUser,
      error,
      isReady,
      profile,
      refreshProfile,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword
    ]
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
