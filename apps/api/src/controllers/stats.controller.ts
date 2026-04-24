import type { Request, Response } from "express";
import { z } from "zod";

import { getUserStats } from "../services/stats.service";

const paramsSchema = z.object({
  userId: z.string().uuid()
});

const querySchema = z.object({
  mode: z.enum(["basic", "advanced"]).default("basic")
});

export const statsController = async (request: Request, response: Response) => {
  const { userId } = paramsSchema.parse(request.params);
  const { mode } = querySchema.parse(request.query);
  const stats = await getUserStats(userId, mode === "advanced");

  response.json({
    data: stats
  });
};
