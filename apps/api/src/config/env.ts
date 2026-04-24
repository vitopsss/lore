import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATA_PROVIDER: z.enum(["postgres", "memory"]).default("postgres"),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/bookboxd"),
  GOOGLE_BOOKS_BASE_URL: z.string().url().default("https://www.googleapis.com/books/v1"),
  OPEN_LIBRARY_BASE_URL: z.string().url().default("https://openlibrary.org"),
  OPEN_LIBRARY_CONTACT_EMAIL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().email().optional()
  ),
  ALLOW_DEMO_BOOK_FALLBACK: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  AMAZON_ASSOCIATE_TAG: z.string().default("seutag-20"),
  APP_NAME: z.string().default("Margem"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);
