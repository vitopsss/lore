import { Router } from "express";

import { activityController } from "../controllers/activity.controller";
import { bookDetailController } from "../controllers/book-detail.controller";
import { featuredBooksController } from "../controllers/discover.controller";
import { feedController } from "../controllers/feed.controller";
import { searchController } from "../controllers/search.controller";
import { shareController } from "../controllers/share.controller";
import { statsController } from "../controllers/stats.controller";
import { createUserController, usersController } from "../controllers/users.controller";
import { env } from "../config/env";
import { asyncHandler } from "../lib/async-handler";
import {
  requirePremiumForAdvancedStats,
  requirePremiumForExclusiveTheme
} from "../middleware/premium-access";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    data: {
      name: env.APP_NAME,
      status: "ok"
    }
  });
});

apiRouter.get("/search", asyncHandler(searchController));
apiRouter.get("/books/detail", asyncHandler(bookDetailController));
apiRouter.get("/discover/highlights", asyncHandler(featuredBooksController));
apiRouter.get("/users", asyncHandler(usersController));
apiRouter.post("/users", asyncHandler(createUserController));
apiRouter.post(
  "/activity",
  requirePremiumForExclusiveTheme,
  asyncHandler(activityController)
);
apiRouter.get("/share/:activityId", asyncHandler(shareController));
apiRouter.get("/api/share/:activityId", asyncHandler(shareController));
apiRouter.get("/feed", asyncHandler(feedController));
apiRouter.get(
  "/stats/:userId",
  requirePremiumForAdvancedStats,
  asyncHandler(statsController)
);
