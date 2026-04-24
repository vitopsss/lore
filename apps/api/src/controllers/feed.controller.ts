import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import { getFeedForUser } from "../services/feed.service";

const feedSchema = z.object({
  userId: z.string().uuid().optional(),
  scope: z.enum(["community", "self"]).default("community")
});

export const feedController = async (request: Request, response: Response) => {
  const { userId: rawUserId, scope } = feedSchema.parse(request.query);
  const userId = request.currentUser?.id ?? rawUserId;

  if (!userId) {
    throw new HttpError(400, "Envie um userId ou autentique o request.", "user_required");
  }

  const feed = await getFeedForUser(userId, scope);

  response.json({
    data: feed
  });
};
