import type { Request, Response, NextFunction } from "express";

export const languageMiddleware = (request: Request, _response: Response, next: NextFunction) => {
  const acceptLanguage = request.headers["accept-language"];

  if (!acceptLanguage) {
    request.language = "pt";
    return next();
  }

  const normalized = acceptLanguage.toLowerCase();

  if (normalized.startsWith("pt")) {
    request.language = "pt";
  } else if (normalized.startsWith("en")) {
    request.language = "en";
  } else {
    request.language = "pt";
  }

  return next();
};

declare global {
  namespace Express {
    interface Request {
      language: "pt" | "en";
    }
  }
}