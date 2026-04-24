import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";
import { HttpError } from "../lib/http-error";
import type { BookInput, StoredBook } from "../types/domain";

import { buildAmazonAffiliateLink } from "./amazon-affiliate.service";

interface BookRow {
  id: string;
  google_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  categories: string[] | null;
  amazon_affiliate_link: string | null;
}

const mapBookRow = (row: BookRow): StoredBook => ({
  id: row.id,
  googleId: row.google_id,
  title: row.title,
  author: row.author,
  coverUrl: row.cover_url,
  isbn: row.isbn,
  pageCount: row.page_count,
  categories: row.categories ?? [],
  amazonAffiliateLink: row.amazon_affiliate_link
});

export const upsertBook = async (book: BookInput): Promise<StoredBook> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.upsertBook(book);
  }

  const amazonAffiliateLink = buildAmazonAffiliateLink(
    book.isbn,
    book.amazonAffiliateLink
  );

  const { rows } = await pool.query<BookRow>(
    `
      insert into books (
        google_id,
        title,
        author,
        cover_url,
        isbn,
        page_count,
        categories,
        amazon_affiliate_link
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (google_id)
      do update set
        title = excluded.title,
        author = excluded.author,
        cover_url = excluded.cover_url,
        isbn = excluded.isbn,
        page_count = excluded.page_count,
        categories = excluded.categories,
        amazon_affiliate_link = excluded.amazon_affiliate_link,
        updated_at = now()
      returning id, google_id, title, author, cover_url, isbn, page_count, categories, amazon_affiliate_link
    `,
    [
      book.googleId,
      book.title,
      book.author,
      book.coverUrl ?? null,
      book.isbn ?? null,
      book.pageCount ?? null,
      book.categories ?? [],
      amazonAffiliateLink
    ]
  );

  return mapBookRow(rows[0]);
};

export const findBookById = async (bookId: string): Promise<StoredBook | null> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.findBookById(bookId);
  }

  const { rows } = await pool.query<BookRow>(
    `
      select id, google_id, title, author, cover_url, isbn, page_count, categories, amazon_affiliate_link
      from books
      where id = $1
      limit 1
    `,
    [bookId]
  );

  return rows[0] ? mapBookRow(rows[0]) : null;
};

export const findBookByIdOrThrow = async (bookId: string) => {
  const book = await findBookById(bookId);

  if (!book) {
    throw new HttpError(404, "Livro não encontrado.", "book_not_found");
  }

  return book;
};
