import type { NextFunction, Request, Response } from "express";

import { EXCLUSIVE_CARD_THEMES } from "../constants/card-themes";
import { HttpError } from "../lib/http-error";
import type { CardThemeName } from "../types/domain";

const assertPremium = (
  request: Request,
  _response: Response,
  next: NextFunction,
  featureName: string
) => {
  if (!request.currentUser) {
    next(
      new HttpError(
        401,
        "Autentique-se com um token Bearer válido para acessar recursos premium.",
        "unauthorized"
      )
    );
    return;
  }

  if (!request.currentUser.premiumStatus) {
    next(new HttpError(403, `${featureName} exige assinatura premium.`, "premium_required"));
    return;
  }

  next();
};

export const requirePremiumForExclusiveTheme = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const theme =
    typeof request.body === "object" && request.body !== null && "cardTheme" in request.body
      ? (request.body.cardTheme as CardThemeName)
      : undefined;

  if (!theme || !EXCLUSIVE_CARD_THEMES.has(theme)) {
    next();
    return;
  }

  assertPremium(request, response, next, "Temas exclusivos de card");
};

export const requirePremiumForAdvancedStats = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const mode = request.query.mode;

  if (mode !== "advanced") {
    next();
    return;
  }

  assertPremium(request, response, next, "Estatísticas avançadas");
};
