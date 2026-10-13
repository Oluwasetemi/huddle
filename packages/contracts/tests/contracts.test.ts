import { describe, expect, it } from "vitest";

import { greet } from "../index.js";

describe("contracts (through entry point)", () => {
  it("greets through the public seam", () => {
    expect(greet("huddle")).toBe("hello, huddle");
  });
});
