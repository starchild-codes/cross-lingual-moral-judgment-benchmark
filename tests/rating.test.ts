import { describe, expect, it } from "vitest";
import { parseRating } from "../lib/rating";

describe("rating parser", () => {
  it("accepts only integers 1 through 7", () => {
    for (const value of ["1", "2", "3", "4", "5", "6", "7"]) {
      expect(parseRating(value)).toBe(Number(value));
    }
    for (const value of ["0", "8", "4.5", "seven", "1 and 2"]) {
      expect(parseRating(value)).toBeNull();
    }
  });

  it("normalizes localized rating digits", () => {
    expect(parseRating("۷")).toBe(7);
    expect(parseRating("٧")).toBe(7);
    expect(parseRating("७")).toBe(7);
    expect(parseRating("৭")).toBe(7);
    expect(parseRating("௭")).toBe(7);
    expect(parseRating("Rating: ৫")).toBe(5);
  });
});
