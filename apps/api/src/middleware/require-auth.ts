import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error";

export const requireAuth = (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  if (!request.currentUser) {
    next(
      new HttpError(
        401,
        "Autentique-se com um token Bearer válido para acessar este recurso.",
        "unauthorized"
      )
    );
    return;
  }

  next();
};
