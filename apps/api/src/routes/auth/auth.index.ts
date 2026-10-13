import { requireAuth } from "@/lib/auth";
import { createRouter } from "@/lib/create-app";

import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = createRouter();

router.use("/auth/me", requireAuth);

router.openapi(routes.register, handlers.register);
router.openapi(routes.login, handlers.login);
router.openapi(routes.me, handlers.me);

export default router;
