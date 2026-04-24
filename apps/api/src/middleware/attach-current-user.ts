import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { HttpError } from "../lib/http-error";
import { verifySupabaseAccessToken } from "../lib/supabase-auth";
import { findUserById, upsertUserFromAuth } from "../services/user.service";

const extractBearerToken = (request: Request) => {
  const authorizationHeader = request.header("authorization");

  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(
      401,
      "Use o header `Authorization: Bearer <token>`.",
      "invalid_authorization_header"
    );
  }

  return token;
};

const extractLegacyUserId = (request: Request) => {
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
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    request.currentUser = await upsertUserFromAuth(
      await verifySupabaseAccessToken(bearerToken)
    );
    next();
    return;
  }

  if (!env.ALLOW_LEGACY_DEV_AUTH) {
    next();
    return;
  }

  const userId = extractLegacyUserId(request);

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
