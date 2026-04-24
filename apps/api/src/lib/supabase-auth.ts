import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { env } from "../config/env";
import { HttpError } from "./http-error";

export interface SupabaseIdentity {
  avatarUrl: string | null;
  email: string | null;
  id: string;
  username: string | null;
}

const supabase =
  env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        }
      })
    : null;

const getMetadataField = (user: User, keys: string[]) => {
  const metadata = user.user_metadata;

  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

export const isSupabaseAuthConfigured = Boolean(supabase);

export const verifySupabaseAccessToken = async (
  accessToken: string
): Promise<SupabaseIdentity> => {
  if (!supabase) {
    throw new HttpError(
      500,
      "Supabase Auth não está configurado na API.",
      "supabase_auth_not_configured"
    );
  }

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new HttpError(
      401,
      "Token de autenticação inválido ou expirado.",
      "invalid_token"
    );
  }

  return {
    avatarUrl: getMetadataField(data.user, ["avatar_url", "picture"]),
    email: data.user.email ?? null,
    id: data.user.id,
    username: getMetadataField(data.user, [
      "username",
      "user_name",
      "preferred_username",
      "nickname",
      "name"
    ])
  };
};
