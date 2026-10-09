import { describe, expect, test } from "bun:test";
import { filterBmsByName, toggleVisibleBms } from "../src/lib/metaBmMenu";

describe("BM search and visible selection", () => {
  const bms = [{ id: "a", nome: "BM São João" }, { id: "b", nome: "BM Medroma" }];
  test("matches names ignoring case and accents", () => {
    expect(filterBmsByName(bms, " SAO JOAO ").map((bm) => bm.id)).toEqual(["a"]);
    expect(filterBmsByName(bms, "inexistente")).toEqual([]);
  });
  test("empty search retains all BMs", () => {
    expect(filterBmsByName(bms, " ")).toEqual(bms);
  });
  test("select all only adds visible results and retains hidden selections", () => {
    expect(toggleVisibleBms(["b"], ["a"])).toEqual(["b", "a"]);
  });
  test("deselect all only removes visible results", () => {
    expect(toggleVisibleBms(["a", "b"], ["a"])).toEqual(["b"]);
  });
  test("no results never clears selection", () => {
    expect(toggleVisibleBms(["b"], [])).toEqual(["b"]);
  });
});