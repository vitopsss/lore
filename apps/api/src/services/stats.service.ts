import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";

interface SummaryRow {
  books_read: string;
  pages_read: string;
}

interface StatusRow {
  type: string;
  total: string;
}

interface GenreRow {
  genre: string;
  total: string;
}

interface AverageDaysRow {
  average_days: string | null;
}

interface AdvancedRow {
  average_rating: string | null;
  completion_rate: string | null;
  monthly_pace: string;
}

export const getUserStats = async (userId: string, advanced: boolean) => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.getStats(userId, advanced);
  }

  const [summaryResult, statusResult, genresResult, averageDaysResult] = await Promise.all([
    pool.query<SummaryRow>(
      `
        with completed_books as (
          select distinct on (book_id) book_id
          from activities
          where user_id = $1
            and type = 'lido'
          order by book_id, coalesce(read_at, created_at::date) desc, created_at desc
        )
        select
          count(*)::text as books_read,
          coalesce(sum(coalesce(b.page_count, 0)), 0)::text as pages_read
        from completed_books cb
        join books b on b.id = cb.book_id
      `,
      [userId]
    ),
    pool.query<StatusRow>(
      `
        select type, count(*)::text as total
        from activities
        where user_id = $1
        group by type
      `,
      [userId]
    ),
    pool.query<GenreRow>(
      `
        with completed_books as (
          select distinct on (book_id) book_id
          from activities
          where user_id = $1
            and type = 'lido'
          order by book_id, coalesce(read_at, created_at::date) desc, created_at desc
        )
        select genre, count(*)::text as total
        from completed_books cb
        join books b on b.id = cb.book_id
        cross join unnest(coalesce(nullif(b.categories, '{}'), array['Sem categoria'])) as genre
        group by genre
        order by count(*) desc, genre asc
        limit 5
      `,
      [userId]
    ),
    pool.query<AverageDaysRow>(
      `
        with finished as (
          select
            book_id,
            max(coalesce(read_at, created_at::date)) as completed_at
          from activities
          where user_id = $1
            and type = 'lido'
          group by book_id
        ),
        started as (
          select
            f.book_id,
            f.completed_at,
            (
              select min(a.created_at::date)
              from activities a
              where a.user_id = $1
                and a.book_id = f.book_id
                and a.type = 'lendo'
                and a.created_at::date <= f.completed_at
            ) as started_at
          from finished f
        )
        select round(avg((completed_at - started_at))::numeric, 1)::text as average_days
        from started
        where started_at is not null
      `,
      [userId]
    )
  ]);

  const response = {
    userId,
    summary: {
      booksRead: Number(summaryResult.rows[0]?.books_read ?? 0),
      pagesRead: Number(summaryResult.rows[0]?.pages_read ?? 0),
      averageDaysToFinish: Number(averageDaysResult.rows[0]?.average_days ?? 0)
    },
    statuses: statusResult.rows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.type] = Number(row.total);
      return accumulator;
    }, {}),
    topGenres: genresResult.rows.map((row) => ({
      genre: row.genre,
      total: Number(row.total)
    }))
  };

  if (!advanced) {
    return response;
  }

  const advancedResult = await pool.query<AdvancedRow>(
    `
      with base as (
        select
          avg(rating) filter (where rating is not null) as average_rating,
          (
            count(*) filter (where type = 'lido')::numeric /
            nullif(count(*) filter (where type in ('lido', 'abandonado')), 0)
          ) * 100 as completion_rate,
          count(*) filter (
            where type = 'lido'
              and coalesce(read_at, created_at::date) >= current_date - interval '30 days'
          ) as monthly_pace
        from activities
        where user_id = $1
      )
      select
        round(average_rating::numeric, 2)::text as average_rating,
        round(completion_rate::numeric, 1)::text as completion_rate,
        monthly_pace::text
      from base
    `,
    [userId]
  );

  return {
    ...response,
    advanced: {
      averageRating: Number(advancedResult.rows[0]?.average_rating ?? 0),
      completionRate: Number(advancedResult.rows[0]?.completion_rate ?? 0),
      monthlyPace: Number(advancedResult.rows[0]?.monthly_pace ?? 0)
    }
  };
};
