import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import { registerActivity } from "../services/activity.service";

const activitySchema = z
  .object({
    userId: z.string().uuid().optional(),
    type: z.enum(["lendo", "lido", "abandonado", "quero_ler"]),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    reviewText: z.string().trim().max(4000).nullable().optional(),
    readAt: z.coerce.date().nullable().optional(),
    cardTheme: z.enum(["classic", "noir", "tropical", "wrapped"]).optional(),
    showExcerpt: z.boolean().optional(),
    bookId: z.string().uuid().optional(),
    book: z
      .object({
        googleId: z.string().min(1),
        title: z.string().min(1),
        author: z.string().min(1),
        coverUrl: z.string().url().nullable().optional(),
        isbn: z.string().nullable().optional(),
        pageCount: z.number().int().positive().nullable().optional(),
        categories: z.array(z.string()).optional(),
        amazonAffiliateLink: z.string().url().nullable().optional()
      })
      .optional()
  })
  .refine((payload) => Boolean(payload.bookId || payload.book), {
    path: ["bookId"],
    message: "Envie um bookId ou o objeto book."
  });

export const activityController = async (request: Request, response: Response) => {
  const payload = activitySchema.parse(request.body);
  const userId = request.currentUser?.id ?? payload.userId;

  if (!userId) {
    throw new HttpError(
      401,
      "Autentique-se com um token Bearer válido para publicar uma atividade.",
      "unauthorized"
    );
  }

  const result = await registerActivity({
    ...payload,
    userId
  });

  response.status(201).json({
    data: result
  });
};
