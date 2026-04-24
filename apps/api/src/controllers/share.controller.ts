import type { Request, Response } from "express";
import { z } from "zod";

import { getActivityShareCard } from "../services/activity.service";

const shareParamsSchema = z.object({
  activityId: z.string().uuid()
});

export const shareController = async (request: Request, response: Response) => {
  const { activityId } = shareParamsSchema.parse(request.params);
  const image = await getActivityShareCard(activityId, request.language);

  response.setHeader("Content-Type", image.contentType);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Disposition", `inline; filename="${image.fileName}"`);
  response.send(image.buffer);
};
