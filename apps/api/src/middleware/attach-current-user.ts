import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error";
import { findUserById } from "../services/user.service";

const extractUserId = (request: Request) => {
  const headerUserId = request.header("x-user-id");
  if (headerUserId) {
    return headerUserId;
  }

  if (typeof request.query.userId === "string") {
    return request.query.userId;
  }

  if (
    typeof request.body === "object" &&
    request.body !== null &&
    "userId" in request.body &&
    typeof request.body.userId === "string"
  ) {
    return request.body.userId;
  }

  return undefined;
};

export const attachCurrentUser = async (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  const userId = extractUserId(request);

  if (!userId) {
    next();
    return;
  }

  const user = await findUserById(userId);

  if (!user) {
    next(new HttpError(404, "Usuário autenticado não encontrado.", "current_user_not_found"));
    return;
  }

  request.currentUser = user;
  next();
};
