# IAGO transfere para humano as propostas vindas do portal

## O que muda
Quando o cliente volta do portal de negociação com a mensagem pronta ("Olá! Meu nome é ..., CPF ... Quero negociar meu débito com ... Gostaria de confirmar as condições e solicitar o boleto."), o IAGO:
- não calcula nem envia proposta, e não se apresenta como assistente virtual;
- envia só uma frase curta: "Recebemos sua proposta. Vou transferir para uma pessoa da nossa equipe confirmar as condições e enviar o boleto. Só um momento, por favor.";
- marca a conversa como "Aguardando Humano" e passa para um atendente da caixa pelo rodízio normal;
- avisa os contatos de emergência com o nome, CPF e resumo da proposta do portal.

Depois disso o IAGO não responde mais nessa conversa (transferência definitiva, como já acontece quando o cliente pede humano).

## Detalhes técnicos
- Nova função `ehPropostaPortal(texto)` em `supabase/functions/_shared/iago.ts`: reconhece o padrão gerado em `src/lib/portalNegotiation.ts` ("Quero negociar meu débito com" + "CPF" + "Gostaria de confirmar as condições" / "solicitar o boleto"), tolerante a acentos e espaços.
- Em `iago-atendimento/index.ts`, verificar antes do bloco de pedido de humano (linha ~418) e antes da apresentação/consulta de débitos; reutilizar o mesmo fluxo de `transferirParaHumano` + estado `aguardando_humano` + `transferencia_humana_definitiva`.
- Vale para qualquer caixa em que o IAGO atenda (exceto AQUECIMENTO, que não negocia).
- Testes em `iago_test.ts`: mensagem real do portal (Odres, Novo Mundo, UME) é detectada; "quero negociar meu débito" solto não é.
- Publicar `iago-atendimento`. Sem custo extra (sem nova rotina).
