import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decidirFluxoConhecido,
  confirmaResponsabilidade,
  RESPOSTA_AGENDAMENTO,
  RESPOSTA_DOCUMENTOS,
  RESPOSTA_VALIDADE,
} from "./regras.ts";

Deno.test("Clara informa um ano para perguntas sobre validade", () => {
  for (const texto of ["Qual período?", "Qual a validade?", "Quanto tempo vale o certificado?"]) {
    const decisao = decidirFluxoConhecido(texto, "conversa", { oferta_apresentada: true });
    assertEquals(decisao?.resposta, RESPOSTA_VALIDADE);
    assertEquals(decisao?.transferir_humano, false);
    assertEquals(decisao?.etapa, "conversa");
  }
});

Deno.test("Clara explica a videoconferência quando perguntam como proceder", () => {
  for (const texto of ["Como procedo?", "Como faço?", "Qual o próximo passo?"]) {
    const decisao = decidirFluxoConhecido(texto, "conversa", { oferta_apresentada: true });
    assertEquals(decisao?.resposta, RESPOSTA_AGENDAMENTO);
    assertEquals(decisao?.etapa, "agendamento");
  }
});

Deno.test("Clara pede os documentos depois da confirmação do agendamento", () => {
  for (const texto of ["Sim", "Pode", "Vamos", "Quero agendar"]) {
    const decisao = decidirFluxoConhecido(texto, "agendamento", { agendamento_oferecido: true });
    assertEquals(decisao?.resposta, RESPOSTA_DOCUMENTOS);
    assertEquals(decisao?.etapa, "aguardando_documentos");
  }
});

Deno.test("Clara não interpreta um sim solto fora do agendamento", () => {
  assertEquals(decidirFluxoConhecido("Sim", "conversa", { oferta_apresentada: true }), null);
});

Deno.test("Clara reconhece quem confirma ser responsável", () => {
  for (const texto of ["Sou responsável sim", "Eu sou o responsável", "Sim, sou eu", "Responsável sou eu"]) {
    assertEquals(confirmaResponsabilidade(texto), true);
  }
  assertEquals(confirmaResponsabilidade("Não sou o responsável"), false);
});