import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../lib/http-error";

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "validation_error",
        message: "Payload inválido.",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "internal_error",
      message: "Erro interno inesperado."
    }
  });
};
