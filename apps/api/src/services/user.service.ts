import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";
import { HttpError } from "../lib/http-error";
import type { CurrentUser, UserSummary } from "../types/domain";

interface UserRow {
  id: string;
  username: string;
  bio: string | null;
  avatar: string | null;
  premium_status: boolean;
  current_streak: number;
  last_read_date: string | null;
}

const mapCurrentUser = (row: Pick<UserRow, "id" | "username" | "premium_status" | "current_streak" | "last_read_date">): CurrentUser => ({
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

export const findUserById = async (userId: string): Promise<CurrentUser | null> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.getUserById(userId);
  }

  const { rows } = await pool.query<UserRow>(
    `
      select id, username, premium_status, current_streak, last_read_date
      from users
      where id = $1
      limit 1
    `,
    [userId]
  );

  return rows[0] ? mapCurrentUser(rows[0]) : null;
};

export const listUsers = async (): Promise<UserSummary[]> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.listUsers();
  }

  const { rows } = await pool.query<UserRow>(
    `
      select id, username, bio, avatar, premium_status, current_streak, last_read_date
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
          username,
          bio,
          avatar,
          premium_status,
          current_streak,
          last_read_date
        )
        values ($1, $2, $3, false, 0, null)
        returning id, username, bio, avatar, premium_status, current_streak, last_read_date
      `,
      [normalizedUsername, bio?.trim() || null, avatar?.trim() || null]
    );

    return mapUserSummary(rows[0]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new HttpError(409, "Esse username ja esta em uso.", "username_taken");
    }

    throw error;
  }
};
