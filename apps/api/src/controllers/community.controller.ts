import type { Request, Response } from "express";

import { getDailyVerse, getNowReadingPulse } from "../services/community.service";

export const communityVerseController = async (_request: Request, response: Response) => {
  const verse = await getDailyVerse();

  response.json({
    data: verse
  });
};

export const communityPulseController = async (_request: Request, response: Response) => {
  const pulse = await getNowReadingPulse();

  response.json({
    data: pulse
  });
};