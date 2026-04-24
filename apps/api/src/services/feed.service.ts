import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";

interface FeedRow {
  activityId: string;
  type: string;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  cardTheme: string;
  createdAt: string;
  userId: string;
  username: string;
  bookId: string;
  googleId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  amazonAffiliateLink: string | null;
}

export const getFeedForUser = async (
  userId: string,
  scope: "community" | "self" = "community"
) => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.getFeedForUser(userId, scope);
  }

  const query =
    scope === "self"
      ? `
          select
            a.id as "activityId",
            a.type,
            a.rating,
            a.review_text as "reviewText",
            a.read_at as "readAt",
            a.card_theme as "cardTheme",
            a.created_at as "createdAt",
            u.id as "userId",
            u.username,
            b.id as "bookId",
            b.google_id as "googleId",
            b.title,
            b.author,
            b.cover_url as "coverUrl",
            b.isbn,
            b.amazon_affiliate_link as "amazonAffiliateLink"
          from activities a
          join users u on u.id = a.user_id
          join books b on b.id = a.book_id
          where a.user_id = $1
          order by a.created_at desc
          limit 30
        `
      : `
          select
            a.id as "activityId",
            a.type,
            a.rating,
            a.review_text as "reviewText",
            a.read_at as "readAt",
            a.card_theme as "cardTheme",
            a.created_at as "createdAt",
            u.id as "userId",
            u.username,
            b.id as "bookId",
            b.google_id as "googleId",
            b.title,
            b.author,
            b.cover_url as "coverUrl",
            b.isbn,
            b.amazon_affiliate_link as "amazonAffiliateLink"
          from activities a
          join users u on u.id = a.user_id
          join books b on b.id = a.book_id
          left join follows f
            on f.following_id = a.user_id
           and f.follower_id = $1
          where a.user_id = $1 or f.follower_id is not null
          order by a.created_at desc
          limit 30
        `;

  const { rows } = await pool.query<FeedRow>(query, [userId]);

  return rows;
};
