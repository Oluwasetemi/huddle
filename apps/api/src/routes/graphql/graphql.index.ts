import { ApolloServer } from "@apollo/server";

import db from "@/db";
import { startServerAndCreateHonoHandler } from "@/lib/apollo-server-hono-integration";
import { createRouter } from "@/lib/create-app";

import { schema } from "./graphql.schema";

const router = createRouter();

const server = new ApolloServer({
  schema,
  introspection: true,
});

const graphqlHandler = startServerAndCreateHonoHandler(server, {
  context: async ({ c }) => ({
    db,
    honoContext: c,
  }),
});

router.all("/graphql", graphqlHandler);

router.get("/graphql-client", (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GraphQL Test Client</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
      textarea, pre { width: 100%; box-sizing: border-box; }
      textarea { min-height: 180px; font-family: ui-monospace, monospace; }
      pre { background: #111827; color: #f9fafb; padding: 1rem; overflow: auto; }
      button { padding: 0.5rem 0.75rem; }
    </style>
  </head>
  <body>
    <h1>GraphQL Test Client</h1>
    <textarea id="query">query { hello tasks { id name done createdAt updatedAt } }</textarea>
    <p><button id="run">Run</button></p>
    <pre id="output">Waiting…</pre>
    <script>
      const query = document.getElementById("query");
      const output = document.getElementById("output");
      document.getElementById("run").addEventListener("click", async () => {
        const response = await fetch("/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: query.value }),
        });
        output.textContent = JSON.stringify(await response.json(), null, 2);
      });
    </script>
  </body>
</html>`);
});

export default router;
