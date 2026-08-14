import { describe, expect, it } from "vitest";
import { allSystemPrompts, getSystemPrompt } from "../lib/prompts";

describe("prompts", () => {
  it("returns exactly 13 system prompts", () => {
    expect(allSystemPrompts()).toHaveLength(13);
  });

  it("rejects EN input with non-English reasoning", () => {
    expect(() => getSystemPrompt("en", "hi")).toThrow();
  });
});
