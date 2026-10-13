import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import auth from "@/routes/auth/auth.index";
import channels from "@/routes/channels/channels.index";
import graphql from "@/routes/graphql/graphql.index";
import index from "@/routes/index.route";
import sse from "@/routes/sse/sse.index";
import tasks from "@/routes/tasks/tasks.index";
import websockets from "@/routes/websockets/websocket.index";

const app = createApp();

configureOpenAPI(app);

const routes = [index, auth, channels, tasks, graphql, websockets, sse] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = (typeof routes)[number];

export default app;
