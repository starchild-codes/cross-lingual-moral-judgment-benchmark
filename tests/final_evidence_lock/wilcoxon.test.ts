import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { wilcoxonSignedRank } from "../../scripts/final_evidence_lock/wilcoxon";

type TestResult = { test: string; status: "passed"; detail: string };

export function runWilcoxonUnitTests(): TestResult[] {
  const results: TestResult[] = [];
  test("six identical positive differences", () => {
    const result = wilcoxonSignedRank([1, 1, 1, 1, 1, 1]);
    close(result.pValue, 0.03125);
    assert.equal(result.wPlus, 21);
    assert.equal(result.tiedAbsoluteRankGroups, 1);
  }, results);
  test("six identical negative differences", () => {
    const result = wilcoxonSignedRank([-1, -1, -1, -1, -1, -1]);
    close(result.pValue, 0.03125);
    assert.equal(result.wPlus, 0);
  }, results);
  test("all zero differences", () => {
    const result = wilcoxonSignedRank([0, 0, 0, 0]);
    assert.equal(result.pValue, 1);
    assert.equal(result.method, "all_zero_no_difference");
  }, results);
  test("balanced signed differences", () => {
    const result = wilcoxonSignedRank([-2, -1, 1, 2]);
    assert.equal(result.pValue, 1);
    assert.equal(result.wPlus, result.wMinus);
  }, results);
  test("ties use average ranks", () => {
    const result = wilcoxonSignedRank([1, 1, 2, -2]);
    assert.equal(result.tiedAbsoluteRankGroups, 2);
    close(result.wPlus, 6.5);
    close(result.wMinus, 3.5);
  }, results);
  test("zero differences are excluded", () => {
    const withZeros = wilcoxonSignedRank([0, 0, 1, 2, 3]);
    const withoutZeros = wilcoxonSignedRank([1, 2, 3]);
    close(withZeros.pValue, withoutZeros.pValue);
    assert.equal(withZeros.nonzeroN, 3);
    assert.equal(withZeros.zeroN, 2);
  }, results);
  test("small no-tie exact result", () => {
    const result = wilcoxonSignedRank([1, 2, 3]);
    close(result.pValue, 0.25);
  }, results);
  test("larger sample uses exact dynamic programming", () => {
    const result = wilcoxonSignedRank(Array.from({ length: 30 }, (_, index) => index + 1));
    close(result.pValue, 2 / 2 ** 30, 1e-18);
    assert.equal(result.exact, true);
    assert.match(result.method, /dynamic_programming/);
  }, results);
  test("sign inversion preserves p-value", () => {
    const values = [0, 1, 1, -2, 3, -4, 4];
    close(wilcoxonSignedRank(values).pValue, wilcoxonSignedRank(values.map((value) => -value)).pValue);
  }, results);
  test("positive scaling preserves result", () => {
    const values = [1, -1, 2, 3, -5];
    const a = wilcoxonSignedRank(values);
    const b = wilcoxonSignedRank(values.map((value) => value * 7));
    close(a.pValue, b.pValue);
    close(a.wPlus, b.wPlus);
  }, results);
  return results;
}

function test(name: string, callback: () => void, results: TestResult[]) {
  callback();
  results.push({ test: name, status: "passed", detail: "assertions completed" });
}

function close(actual: number, expected: number, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}`);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const results = runWilcoxonUnitTests();
  console.log(`${results.length} Wilcoxon tests passed.`);
}

describe("Wilcoxon signed-rank implementation", () => {
  it("passes the complete custom unit-test harness", () => {
    expect(runWilcoxonUnitTests()).toHaveLength(10);
  });
});
