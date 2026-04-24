import type { Request, Response } from "express";
import { z } from "zod";

import { getBookDetail } from "../services/book-detail.service";

const bookDetailQuerySchema = z.object({
  googleId: z.string().trim().min(1)
});

export const bookDetailController = async (request: Request, response: Response) => {
  const { googleId } = bookDetailQuerySchema.parse(request.query);
  const detail = await getBookDetail(googleId, request.language, request.currentUser?.id);

  response.json({
    data: detail
  });
};
