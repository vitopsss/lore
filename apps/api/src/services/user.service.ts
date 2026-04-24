import { randomUUID } from "node:crypto";

import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";
import { HttpError } from "../lib/http-error";
import type { SupabaseIdentity } from "../lib/supabase-auth";
import type { CurrentUser, UserSummary } from "../types/domain";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  bio: string | null;
  avatar: string | null;
  premium_status: boolean;
  current_streak: number;
  last_read_date: string | null;
}

const mapCurrentUser = (
  row: Pick<UserRow, "id" | "username" | "premium_status" | "current_streak" | "last_read_date">
): CurrentUser => ({
  id: row.id,
  username: row.username,
  premiumStatus: row.premium_status,
  currentStreak: row.current_streak,
  lastReadDate: row.last_read_date
});

const mapUserSummary = (row: UserRow): UserSummary => ({
  ...mapCurrentUser(row),
  bio: row.bio,
  avatar: row.avatar
});

const normalizeUsernameSeed = (value: string) => {
  const withoutAccents = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalized = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (normalized.length >= 3) {
    return normalized.slice(0, 24);
  }

  return "reader";
};

const isUsernameTaken = async (username: string, excludeUserId?: string) => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore
      .listUsers()
      .some(
        (user) =>
          user.id !== excludeUserId &&
          user.username.trim().toLowerCase() === username.trim().toLowerCase()
      );
  }

  const { rows } = await pool.query<{ exists: boolean }>(
    `
      select exists(
        select 1
        from users
        where username = $1
          and ($2::uuid is null or id <> $2)
      ) as exists
    `,
    [username, excludeUserId ?? null]
  );

  return Boolean(rows[0]?.exists);
};

const resolveAvailableUsername = async (seed: string, userId: string) => {
  const base = normalizeUsernameSeed(seed);

  for (let index = 0; index < 50; index += 1) {
    const suffix = index === 0 ? "" : `_${index + 1}`;
    const candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`;

    if (!(await isUsernameTaken(candidate, userId))) {
      return candidate;
    }
  }

  return `${base.slice(0, 15)}_${userId.replace(/-/g, "").slice(0, 8)}`.slice(0, 24);
};

const buildUsernameSeedFromAuth = (authUser: SupabaseIdentity) =>
  authUser.username?.trim() ||
  authUser.email?.split("@")[0]?.trim() ||
  `reader_${authUser.id.replace(/-/g, "").slice(0, 8)}`;

export const findUserById = async (userId: string): Promise<CurrentUser | null> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.getUserById(userId);
  }

  const { rows } = await pool.query<UserRow>(
    `
      select id, username, email, premium_status, current_streak, last_read_date
      from users
      where id = $1
      limit 1
    `,
    [userId]
  );

  return rows[0] ? mapCurrentUser(rows[0]) : null;
};

export const findUserSummaryById = async (userId: string): Promise<UserSummary | null> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.listUsers().find((user) => user.id === userId) ?? null;
  }

  const { rows } = await pool.query<UserRow>(
    `
      select id, username, email, bio, avatar, premium_status, current_streak, last_read_date
      from users
      where id = $1
      limit 1
    `,
    [userId]
  );

  return rows[0] ? mapUserSummary(rows[0]) : null;
};

export const listUsers = async (): Promise<UserSummary[]> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.listUsers();
  }

  const { rows } = await pool.query<UserRow>(
    `
      select id, username, email, bio, avatar, premium_status, current_streak, last_read_date
      from users
      order by created_at desc
    `
  );

  return rows.map(mapUserSummary);
};

export const createUser = async ({
  username,
  bio,
  avatar
}: {
  username: string;
  bio?: string | null;
  avatar?: string | null;
}): Promise<UserSummary> => {
  const normalizedUsername = username.trim();

  if (env.DATA_PROVIDER === "memory") {
    try {
      return memoryStore.createUser({
        username: normalizedUsername,
        bio,
        avatar
      });
    } catch (error) {
      if (error instanceof Error && error.message === "username_taken") {
        throw new HttpError(409, "Esse username ja esta em uso.", "username_taken");
      }

      throw error;
    }
  }

  try {
    const { rows } = await pool.query<UserRow>(
      `
        insert into users (
          id,
          username,
          email,
          bio,
          avatar,
          premium_status,
          current_streak,
          last_read_date
        )
        values ($1, $2, null, $3, $4, false, 0, null)
        returning
          id,
          username,
          email,
          bio,
          avatar,
          premium_status,
          current_streak,
          last_read_date
      `,
      [randomUUID(), normalizedUsername, bio?.trim() || null, avatar?.trim() || null]
    );

    return mapUserSummary(rows[0]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new HttpError(409, "Esse username ja esta em uso.", "username_taken");
    }

    throw error;
  }
};

export const upsertUserFromAuth = async (authUser: SupabaseIdentity): Promise<UserSummary> => {
  const existingUser = await findUserSummaryById(authUser.id);

  if (existingUser) {
    if (env.DATA_PROVIDER === "memory") {
      return memoryStore.upsertAuthUser({
        id: authUser.id,
        username: existingUser.username,
        email: authUser.email,
        avatar: authUser.avatarUrl
      });
    }

    const { rows } = await pool.query<UserRow>(
      `
        update users
        set
          email = coalesce($2, email),
          avatar = coalesce($3, avatar),
          updated_at = now()
        where id = $1
        returning
          id,
          username,
          email,
          bio,
          avatar,
          premium_status,
          current_streak,
          last_read_date
      `,
      [authUser.id, authUser.email?.trim().toLowerCase() || null, authUser.avatarUrl]
    );

    return mapUserSummary(rows[0]);
  }

  const resolvedUsername = await resolveAvailableUsername(
    buildUsernameSeedFromAuth(authUser),
    authUser.id
  );

  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.upsertAuthUser({
      id: authUser.id,
      username: resolvedUsername,
      email: authUser.email,
      avatar: authUser.avatarUrl
    });
  }

  try {
    const { rows } = await pool.query<UserRow>(
      `
        insert into users (
          id,
          username,
          email,
          bio,
          avatar,
          premium_status,
          current_streak,
          last_read_date
        )
        values ($1, $2, $3, null, $4, false, 0, null)
        returning
          id,
          username,
          email,
          bio,
          avatar,
          premium_status,
          current_streak,
          last_read_date
      `,
      [
        authUser.id,
        resolvedUsername,
        authUser.email?.trim().toLowerCase() || null,
        authUser.avatarUrl
      ]
    );

    return mapUserSummary(rows[0]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      const fallbackUsername = await resolveAvailableUsername(
        `${resolvedUsername}_${authUser.id.replace(/-/g, "").slice(0, 4)}`,
        authUser.id
      );

      const { rows } = await pool.query<UserRow>(
        `
          insert into users (
            id,
            username,
            email,
            bio,
            avatar,
            premium_status,
            current_streak,
            last_read_date
          )
          values ($1, $2, $3, null, $4, false, 0, null)
          on conflict (id) do update
          set
            email = coalesce(excluded.email, users.email),
            avatar = coalesce(excluded.avatar, users.avatar),
            updated_at = now()
          returning
            id,
            username,
            email,
            bio,
            avatar,
            premium_status,
            current_streak,
            last_read_date
        `,
        [
          authUser.id,
          fallbackUsername,
          authUser.email?.trim().toLowerCase() || null,
          authUser.avatarUrl
        ]
      );

      return mapUserSummary(rows[0]);
    }

    throw error;
  }
};
