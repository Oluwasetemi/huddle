import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
} from "@apollo/server";
import type { Context } from "hono";

import { HeaderMap } from "@apollo/server";

export type HonoContextFunctionArgument = {
  req: Context["req"];
  c: Context;
};

export type HonoIntegrationOptions<TContext extends BaseContext = BaseContext> = {
  context?: ContextFunction<[HonoContextFunctionArgument], TContext>;
};

export function startServerAndCreateHonoHandler<TContext extends BaseContext = BaseContext>(
  server: ApolloServer<TContext>,
  options?: HonoIntegrationOptions<TContext>,
) {
  let started = false;

  const ensureStarted = async () => {
    if (!started) {
      await server.start();
      started = true;
    }
  };

  return async (c: Context) => {
    try {
      await ensureStarted();

      const req = c.req;
      let body: unknown;

      if (
        req.method !== "GET"
        && req.header("content-type")?.includes("application/json")
      ) {
        try {
          body = await req.json();
        }
        catch {
          return c.json(
            { errors: [{ message: "Invalid JSON in request body" }] },
            400,
          );
        }
      }

      const headers = new HeaderMap();
      req.raw.headers.forEach((value, key) => {
        headers.set(key, value);
      });

      const httpGraphQLRequest: HTTPGraphQLRequest = {
        method: req.method as "GET" | "POST",
        headers,
        search: new URL(req.url).search,
        body,
      };

      const contextValue = options?.context
        ? await options.context({ req, c })
        : ({} as TContext);

      const response = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: async () => contextValue,
      });

      for (const [key, value] of response.headers) {
        c.header(key, value);
      }

      let payload = "";
      if (response.body.kind === "complete") {
        payload = response.body.string;
      }
      else {
        for await (const chunk of response.body.asyncIterator) {
          payload += chunk;
        }
      }

      return c.newResponse(payload, (response.status ?? 200) as 200);
    }
    catch (error) {
      console.error("GraphQL execution error:", error);
      return c.json({ errors: [{ message: "Internal server error" }] }, 500);
    }
  };
}
