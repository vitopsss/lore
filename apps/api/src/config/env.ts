import "dotenv/config";

import { z } from "zod";

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATA_PROVIDER: z.enum(["postgres", "memory"]).default("postgres"),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/lore"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
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
  ALLOW_LEGACY_DEV_AUTH: z.enum(["true", "false"]).optional(),
  AMAZON_ASSOCIATE_TAG: z.string().default("seutag-20"),
  APP_NAME: z.string().default("Lore"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

const parsedEnv = rawEnvSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  ALLOW_LEGACY_DEV_AUTH:
    parsedEnv.ALLOW_LEGACY_DEV_AUTH === undefined
      ? parsedEnv.NODE_ENV !== "production"
      : parsedEnv.ALLOW_LEGACY_DEV_AUTH === "true"
};
