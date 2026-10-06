import { describe, it, expect } from "bun:test";
import { voltouParaGreen } from "../supabase/functions/_shared/meta-voltou-green";

describe("voltouParaGreen", () => {
  it("RED → GREEN dispara", () => expect(voltouParaGreen("RED", "GREEN")).toBe(true));
  it("YELLOW → GREEN dispara", () => expect(voltouParaGreen("yellow", "GREEN")).toBe(true));
  it("GREEN → GREEN não dispara", () => expect(voltouParaGreen("GREEN", "GREEN")).toBe(false));
  it("GREEN → RED não dispara", () => expect(voltouParaGreen("GREEN", "RED")).toBe(false));
  it("UNKNOWN → GREEN não dispara", () => expect(voltouParaGreen("UNKNOWN", "GREEN")).toBe(false));
});
