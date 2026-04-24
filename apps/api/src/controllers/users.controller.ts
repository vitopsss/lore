import type { Request, Response } from "express";
import { z } from "zod";

import { createUser, listUsers } from "../services/user.service";

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Use apenas letras, numeros e underscore."),
  bio: z.string().trim().max(160).optional(),
  avatar: z.string().trim().url().optional()
});

export const usersController = async (_request: Request, response: Response) => {
  const users = await listUsers();

  response.json({
    data: users
  });
};

export const createUserController = async (request: Request, response: Response) => {
  const payload = createUserSchema.parse(request.body);
  const user = await createUser(payload);

  response.status(201).json({
    data: user
  });
};
