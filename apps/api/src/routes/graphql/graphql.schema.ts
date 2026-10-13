import { makeExecutableSchema } from "@graphql-tools/schema";
import { eq } from "drizzle-orm";

import db from "@/db";
import { tasks } from "@/db/schema";
import { pubsub, SUBSCRIPTION_EVENTS } from "@/lib/pubsub";

type TaskUpdateInput = {
  name?: string;
  done?: boolean;
};

const typeDefs = /* GraphQL */ `
  type Task {
    id: Int!
    name: String!
    done: Boolean!
    createdAt: String
    updatedAt: String
  }

  type DeletedTask {
    id: Int!
  }

  input CreateTaskInput {
    name: String!
    done: Boolean = false
  }

  input UpdateTaskInput {
    name: String
    done: Boolean
  }

  type Query {
    hello: String!
    tasks: [Task!]!
    task(id: Int!): Task
  }

  type Mutation {
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: Int!, input: UpdateTaskInput!): Task!
    deleteTask(id: Int!): DeletedTask!
  }

  type Subscription {
    taskCreated: Task!
    taskUpdated: Task!
    taskDeleted: DeletedTask!
  }
`;

const resolvers = {
  Query: {
    hello: () => "Hello, world!",
    tasks: async () => db.query.tasks.findMany(),
    task: async (_root: unknown, { id }: { id: number }) => {
      return db.query.tasks.findFirst({
        where(fields, operators) {
          return operators.eq(fields.id, id);
        },
      });
    },
  },
  Mutation: {
    createTask: async (_root: unknown, { input }: { input: { name: string; done?: boolean } }) => {
      const [task] = await db.insert(tasks).values({
        name: input.name,
        done: input.done ?? false,
      }).returning();

      await pubsub.publish(SUBSCRIPTION_EVENTS.TASK_CREATED, { taskCreated: task });
      return task;
    },
    updateTask: async (_root: unknown, { id, input }: { id: number; input: TaskUpdateInput }) => {
      const [task] = await db
        .update(tasks)
        .set(input)
        .where(eq(tasks.id, id))
        .returning();

      if (!task) {
        throw new Error("Task not found");
      }

      await pubsub.publish(SUBSCRIPTION_EVENTS.TASK_UPDATED, { taskUpdated: task });
      return task;
    },
    deleteTask: async (_root: unknown, { id }: { id: number }) => {
      const result = await db.delete(tasks).where(eq(tasks.id, id));
      if (result.rowsAffected === 0) {
        throw new Error("Task not found");
      }

      const payload = { id };
      await pubsub.publish(SUBSCRIPTION_EVENTS.TASK_DELETED, { taskDeleted: payload });
      return payload;
    },
  },
  Subscription: {
    taskCreated: {
      subscribe: () => pubsub.asyncIterableIterator(SUBSCRIPTION_EVENTS.TASK_CREATED),
    },
    taskUpdated: {
      subscribe: () => pubsub.asyncIterableIterator(SUBSCRIPTION_EVENTS.TASK_UPDATED),
    },
    taskDeleted: {
      subscribe: () => pubsub.asyncIterableIterator(SUBSCRIPTION_EVENTS.TASK_DELETED),
    },
  },
};

export const schema = makeExecutableSchema({ typeDefs, resolvers });
