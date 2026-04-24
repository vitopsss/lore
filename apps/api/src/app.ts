import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler";
import { attachCurrentUser } from "./middleware/attach-current-user";
import { languageMiddleware } from "./middleware/language";
import { apiRouter } from "./routes";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: "*"
    })
  );
  app.use(express.json({ limit: "4mb" }));
  app.use(attachCurrentUser);
  app.use(languageMiddleware);
  app.use(apiRouter);
  app.use(errorHandler);

  return app;
};
