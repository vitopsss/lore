import type { Request, Response } from "express";

import { HttpError } from "../lib/http-error";
import { findUserSummaryById } from "../services/user.service";

export const meController = async (request: Request, response: Response) => {
  const userId = request.currentUser?.id;

  if (!userId) {
    throw new HttpError(
      401,
      "Autentique-se com um token Bearer válido para acessar seu perfil.",
      "unauthorized"
    );
  }

  const user = await findUserSummaryById(userId);

  if (!user) {
    throw new HttpError(404, "Usuário autenticado não encontrado.", "current_user_not_found");
  }

  response.json({
    data: user
  });
};
