import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";
import type { StoredBook } from "../types/domain";

interface DailyVerse {
  quote: string;
  bookTitle: string;
  author: string;
}

interface NowReadingBook {
  book: StoredBook;
  readerCount: number;
  latestReader: string;
}

interface VerseRow {
  reviewText: string;
  title: string;
  author: string;
}

const getVerseFromMemory = (): DailyVerse | null => {
  const activitiesWithQuotes = memoryStore.listUsers().length > 0
    ? memoryStore.listUsers().flatMap(() => {
        const allActivities = (memoryStore as unknown as { getFeedForUser: (userId: string) => unknown[] }).getFeedForUser
          ? []
          : [];

        return allActivities
          .filter((activity: unknown) => {
            const a = activity as { reviewText: string | null };
            return Boolean(a.reviewText && a.reviewText.trim().length > 10);
          })
          .map((activity: unknown) => {
            const a = activity as { reviewText: string | null };
            return a.reviewText;
          });
      })
    : [];

  if (activitiesWithQuotes.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * activitiesWithQuotes.length);
  const quoteText = activitiesWithQuotes[randomIndex];

  if (!quoteText) {
    return null;
  }

  return {
    quote: quoteText.slice(0, 280),
    bookTitle: "Livro da Comunidade",
    author: "Lore"
  };
};

export const getDailyVerse = async (): Promise<DailyVerse> => {
  if (env.DATA_PROVIDER === "memory") {
    const verse = getVerseFromMemory();

    if (verse) {
      return verse;
    }

    return {
      quote: "Um livro é um sonho que você segura nas mãos. — Neil Gaiman",
      bookTitle: "Neil Gaiman",
      author: "Autor Conhecido"
    };
  }

  try {
    const { rows } = await pool.query<VerseRow>(
      `
        select a.review_text as "reviewText", b.title, b.author
        from activities a
        join books b on b.id = a.book_id
        where a.review_text is not null
          and length(a.review_text) > 10
        order by random()
        limit 1
      `
    );

    if (rows.length > 0) {
      return {
        quote: rows[0].reviewText,
        bookTitle: rows[0].title,
        author: rows[0].author
      };
    }
  } catch {
    // fallback
  }

  return {
    quote: "Um livro é um sonho que você segura nas mãos. — Neil Gaiman",
    bookTitle: "Neil Gaiman",
    author: "Autor Conhecido"
  };
};

interface PulseRow {
  googleId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  pageCount: number | null;
  categories: string[] | null;
  amazonAffiliateLink: string | null;
  readerCount: number;
  latestReader: string;
}

const getNowReadingFromMemory = (): NowReadingBook[] => {
  return [];
};

export const getNowReadingPulse = async (): Promise<NowReadingBook[]> => {
  if (env.DATA_PROVIDER === "memory") {
    return getNowReadingFromMemory();
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString();

  try {
    const { rows } = await pool.query<PulseRow>(
      `
        select
          b.google_id as "googleId",
          b.title,
          b.author,
          b.cover_url as "coverUrl",
          b.isbn,
          b.page_count as "pageCount",
          b.categories,
          b.amazon_affiliate_link as "amazonAffiliateLink",
          count(a.user_id) as "readerCount",
          max(u.username) as "latestReader"
        from activities a
        join books b on b.id = a.book_id
        join users u on u.id = a.user_id
        where a.type = 'lendo'
          and a.created_at > $1
        group by b.id
        order by "readerCount" desc
        limit 12
      `,
      [yesterdayISO]
    );

    return rows.map((row) => ({
      book: {
        id: "",
        googleId: row.googleId,
        title: row.title,
        author: row.author,
        coverUrl: row.coverUrl,
        isbn: row.isbn,
        pageCount: row.pageCount,
        categories: row.categories ?? [],
        amazonAffiliateLink: row.amazonAffiliateLink
      },
      readerCount: Number(row.readerCount),
      latestReader: row.latestReader
    }));
  } catch {
    return [];
  }
};