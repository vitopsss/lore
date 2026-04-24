import type { Request, Response } from "express";
import { z } from "zod";

import { getFeaturedBooks } from "../services/google-books.service";

const discoverQuerySchema = z.object({
  language: z.string().trim().min(2).optional(),
  mode: z.enum(["popular", "anticipated"]).optional()
});

export const featuredBooksController = async (request: Request, response: Response) => {
  const { language, mode } = discoverQuerySchema.parse(request.query);
  const books = await getFeaturedBooks(language ?? "pt", mode ?? "popular");

  response.json({
    data: books
  });
};
