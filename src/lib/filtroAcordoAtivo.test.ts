import { describe, it, expect } from "vitest";
import { separarPorAcordoAtivo, type AcordoAtivoMatch } from "./filtroAcordoAtivo";

const ac = (p: Partial<AcordoAtivoMatch>): AcordoAtivoMatch => ({
  acordo_id: "1", cpf: null, telefone: null, cliente_nome: null, empresa: null,
  responsavel: null, criado_em: null, status: "ativo", sufixo: null, cpf_norm: null, ...p,
});

describe("separarPorAcordoAtivo", () => {
  it("exclui por CPF com ou sem pontuação", () => {
    const r = separarPorAcordoAtivo([{ telefone: "62999990000", cpf: "123.456.789-01" }], [ac({ cpf: "12345678901" })]);
    expect(r.excluidos).toHaveLength(1);
    expect(r.excluidos[0].encontradoPor).toBe("CPF");
  });
  it("exclui por telefone com ou sem 55", () => {
    const r = separarPorAcordoAtivo([{ telefone: "5562988887777" }], [ac({ telefone: "(62) 98888-7777" })]);
    expect(r.excluidos[0].encontradoPor).toBe("Telefone");
  });
  it("encontrado pelos dois aparece uma vez", () => {
    const r = separarPorAcordoAtivo([{ telefone: "62988887777", cpf: "111" }], [ac({ cpf: "111" }), ac({ acordo_id: "2", telefone: "62988887777" })]);
    expect(r.excluidos).toHaveLength(1);
    expect(r.excluidos[0].encontradoPor).toBe("CPF e telefone");
  });
  it("quebrado e concluído não bloqueiam", () => {
    const r = separarPorAcordoAtivo([{ telefone: "62988887777", cpf: "111" }], [ac({ cpf: "111", status: "quebrado" }), ac({ telefone: "62988887777", status: "concluido" })]);
    expect(r.liberados).toHaveLength(1);
  });
});
