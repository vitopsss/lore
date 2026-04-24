import type { Request, Response } from "express";
import { z } from "zod";

import { searchCatalogBooks } from "../services/google-books.service";

const searchSchema = z.object({
  q: z.string().trim().min(2).optional(),
  releaseDate: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Use um ano com quatro digitos.")
    .optional(),
  genre: z.string().trim().min(2).optional(),
  country: z.string().trim().min(2).optional(),
  language: z.string().trim().min(2).optional(),
  service: z.string().trim().min(2).optional()
});

export const searchController = async (request: Request, response: Response) => {
  const { q = "", ...filters } = searchSchema.parse(request.query);
  const books = await searchCatalogBooks(q, filters);

  response.json({
    data: books
  });
};
