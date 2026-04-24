import { env } from "../config/env";
import { DEFAULT_CARD_THEME } from "../constants/card-themes";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";
import { normalizeActivityDay, resolveNextStreak, toStreakTimestamp } from "../lib/streaks";
import { HttpError } from "../lib/http-error";
import type { ActivityType, BookInput, CardThemeName, StreakSnapshot } from "../types/domain";

import { findBookByIdOrThrow, upsertBook } from "./book.service";
import {
  buildStoryCardImage,
  buildStoryCardPreview,
  type ShareCardRenderInput
} from "./card-generator.service";
import { findUserById } from "./user.service";

interface ActivityRow {
  id: string;
  userId: string;
  bookId: string;
  type: ActivityType;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  cardTheme: CardThemeName;
  showExcerpt: boolean;
  createdAt: string;
}

interface UserStreakRow {
  current_streak: number;
  last_read_date: string | null;
}

interface ActivityShareRow {
  activityId: string;
  type: ActivityType;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  createdAt: string;
  cardTheme: CardThemeName;
  showExcerpt: boolean;
  username: string;
  title: string;
  author: string;
  coverUrl: string | null;
}

const mapStreakSnapshot = (value: {
  currentStreak: number;
  lastReadDate: string | null;
}): StreakSnapshot => ({
  currentStreak: value.currentStreak,
  lastReadDate: value.lastReadDate
});

const buildShareCardInput = (payload: ActivityShareRow): ShareCardRenderInput => ({
  activityId: payload.activityId,
  title: payload.title,
  author: payload.author,
  coverUrl: payload.coverUrl,
  rating: payload.rating,
  excerpt: payload.reviewText,
  theme: payload.cardTheme,
  showExcerpt: payload.showExcerpt
});

const insertActivityWithStreak = async ({
  userId,
  bookId,
  type,
  rating,
  reviewText,
  normalizedReadAt,
  normalizedTheme,
  showExcerpt,
  activityDay
}: {
  userId: string;
  bookId: string;
  type: ActivityType;
  rating: number | null;
  reviewText: string | null;
  normalizedReadAt: string | null;
  normalizedTheme: CardThemeName;
  showExcerpt: boolean;
  activityDay: string;
}): Promise<{ activity: ActivityRow; streak: StreakSnapshot }> => {
  if (env.DATA_PROVIDER === "memory") {
    const result = memoryStore.insertActivity({
      userId,
      bookId,
      type,
      rating,
      reviewText,
      readAt: normalizedReadAt,
      cardTheme: normalizedTheme,
      showExcerpt
    });

    const streak = result.streak
      ? mapStreakSnapshot(result.streak)
      : {
          currentStreak: 1,
          lastReadDate: toStreakTimestamp(activityDay)
        };

    return {
      activity: result.activity,
      streak
    };
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const userResult = await client.query<UserStreakRow>(
      `
        select current_streak, last_read_date
        from users
        where id = $1
        for update
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new HttpError(404, "Usuário não encontrado.", "user_not_found");
    }

    const nextStreak = resolveNextStreak({
      currentStreak: userResult.rows[0].current_streak ?? 0,
      lastReadDate: userResult.rows[0].last_read_date,
      nextReadDate: activityDay
    });

    await client.query(
      `
        update users
        set
          current_streak = $2,
          last_read_date = $3,
          updated_at = now()
        where id = $1
      `,
      [userId, nextStreak.currentStreak, toStreakTimestamp(nextStreak.lastReadDate)]
    );

    const activityResult = await client.query<ActivityRow>(
      `
        insert into activities (
          user_id,
          book_id,
          type,
          rating,
          review_text,
          read_at,
          card_theme,
          show_excerpt
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          user_id as "userId",
          book_id as "bookId",
          type,
          rating,
          review_text as "reviewText",
          read_at as "readAt",
          card_theme as "cardTheme",
          show_excerpt as "showExcerpt",
          created_at as "createdAt"
      `,
      [userId, bookId, type, rating, reviewText, normalizedReadAt, normalizedTheme, showExcerpt]
    );

    await client.query("commit");

    return {
      activity: activityResult.rows[0],
      streak: {
        currentStreak: nextStreak.currentStreak,
        lastReadDate: toStreakTimestamp(nextStreak.lastReadDate)
      }
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const findActivityShareRow = async (activityId: string): Promise<ActivityShareRow | null> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.getActivityShareCardData(activityId);
  }

  const { rows } = await pool.query<ActivityShareRow>(
    `
      select
        a.id as "activityId",
        a.type,
        a.rating,
        a.review_text as "reviewText",
        a.read_at as "readAt",
        a.created_at as "createdAt",
        a.card_theme as "cardTheme",
        a.show_excerpt as "showExcerpt",
        u.username,
        b.title,
        b.author,
        b.cover_url as "coverUrl"
      from activities a
      join users u on u.id = a.user_id
      join books b on b.id = a.book_id
      where a.id = $1
      limit 1
    `,
    [activityId]
  );

  return rows[0] ?? null;
};

export const registerActivity = async ({
  userId,
  type,
  rating,
  reviewText,
  readAt,
  cardTheme,
  showExcerpt,
  bookId,
  book
}: {
  userId: string;
  type: ActivityType;
  rating?: number | null;
  reviewText?: string | null;
  readAt?: Date | null;
  cardTheme?: CardThemeName;
  showExcerpt?: boolean;
  bookId?: string;
  book?: BookInput;
}) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(404, "Usuário não encontrado.", "user_not_found");
  }

  const storedBook = bookId
    ? await findBookByIdOrThrow(bookId)
    : book
      ? await upsertBook(book)
      : null;

  if (!storedBook) {
    throw new HttpError(400, "Envie um `bookId` ou o payload do livro.", "book_required");
  }

  const normalizedReadAt = readAt ? readAt.toISOString().slice(0, 10) : null;
  const normalizedTheme = cardTheme ?? DEFAULT_CARD_THEME;
  const normalizedShowExcerpt = showExcerpt ?? true;
  const activityDay = normalizeActivityDay(normalizedReadAt);

  const result = await insertActivityWithStreak({
    userId,
    bookId: storedBook.id,
    type,
    rating: rating ?? null,
    reviewText: reviewText ?? null,
    normalizedReadAt,
    normalizedTheme,
    showExcerpt: normalizedShowExcerpt,
    activityDay
  });

  const shareCard = await buildStoryCardPreview({
    activityId: result.activity.id,
    title: storedBook.title,
    author: storedBook.author,
    coverUrl: storedBook.coverUrl,
    rating: result.activity.rating,
    excerpt: result.activity.reviewText,
    theme: normalizedTheme,
    showExcerpt: normalizedShowExcerpt
  });

  return {
    activity: result.activity,
    book: storedBook,
    streak: result.streak,
    shareCard
  };
};

export const getActivityShareCard = async (activityId: string) => {
  const activity = await findActivityShareRow(activityId);

  if (!activity) {
    throw new HttpError(404, "Atividade não encontrada.", "activity_not_found");
  }

  return buildStoryCardImage(buildShareCardInput(activity));
};
