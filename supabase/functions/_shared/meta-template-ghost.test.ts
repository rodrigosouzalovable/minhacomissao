import { assertEquals } from "jsr:@std/assert";
import { isGhostSubmission } from "./meta-template-completion.ts";
const old = new Date(Date.now() - 13 * 3600_000).toISOString();
Deno.test("ENVIADO sem id, antigo e ausente na Meta é fantasma", () => assertEquals(isGhostSubmission({ status: "ENVIADO", meta_template_id: null, atualizado_em: old }, false), true));
Deno.test("com id da Meta nunca é fantasma", () => assertEquals(isGhostSubmission({ status: "ENVIADO", meta_template_id: "1", atualizado_em: old }, false), false));
Deno.test("existindo na Meta nunca é fantasma", () => assertEquals(isGhostSubmission({ status: "PENDING", atualizado_em: old }, true), false));
Deno.test("recente (<12h) não é fantasma", () => assertEquals(isGhostSubmission({ status: "ENVIADO", atualizado_em: new Date().toISOString() }, false), false));
