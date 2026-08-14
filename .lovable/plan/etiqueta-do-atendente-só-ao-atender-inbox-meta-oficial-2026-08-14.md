# Etiqueta do atendente só ao atender (Inbox Meta Oficial)

Hoje a conversa já nasce etiquetada: no envio (template/texto) e, quando o cliente responde, o rodízio da fila sorteia um atendente. A nova regra: a etiqueta é de quem **atender primeiro**.

## Como vai funcionar

1. **Nada de etiqueta no envio.** Disparos de template e texto livre deixam de aplicar a etiqueta `Atendente: <Nome>`, mesmo com o nome do atendente na mensagem.
2. **Cliente responde → conversa fica sem atendente**, esperando quem atender.
3. **Primeiro atendente que responder ganha a conversa.** Ao enviar a primeira mensagem de atendente (texto livre ou template de reabertura) numa conversa sem etiqueta de atendente, a conversa recebe a etiqueta desse atendente (`origem = auto_atendente`). Continua valendo: só etiquetas já existentes, atendente com permissão "Atende no Inbox Meta Oficial" e responsável pela caixa; no máximo uma etiqueta de atendente por conversa.
4. **Exceções mantidas** (conforme sua escolha): se o telefone já tem acordo lançado, ou consulta de CPF no portal nos últimos 7 dias, a etiqueta continua indo automaticamente para o atendente correspondente quando o cliente responde.
5. **IAGO (IA) continua no rodízio.** A fila circular por caixa continua rodando quando o cliente responde, mas **só efetiva a etiqueta quando a vez é do IAGO** — assim a IA continua recebendo conversas na proporção dela. Quando a vez cai num atendente humano, a fila avança e a conversa fica livre para quem atender primeiro.
6. **Histórico intacto:** etiquetas já aplicadas ficam como estão.

## Detalhes técnicos

- `supabase/functions/send-whatsapp-meta/index.ts`: remover a chamada de `aplicarEtiquetaAtendente` no envio de template quando é conversa nova; manter a aplicação apenas em reabertura por atendente (conversa já existente e sem etiqueta de atendente).
- `supabase/functions/send-whatsapp-meta-text/index.ts`: manter/garantir a aplicação com `somenteSeSemEtiqueta: true`, usando o atendente que está enviando (nome no prefixo `*Atendente <Nome>:*`, senão `profiles.nome` do `user_id`); mensagens com `origem = 'ia'` seguem sem etiquetar.
- `supabase/functions/_shared/etiqueta-atendente.ts`: sem mudança de regras de elegibilidade; passa a ser sempre chamado com `somenteSeSemEtiqueta: true`.
- `supabase/functions/meta-whatsapp-webhook/index.ts`: manter os matches por acordo e por consulta no portal; **remover** o match "quem iniciou a conversa" (prefixo na última saída); no bloco do rodízio, chamar `atribuir_atendente_rodizio` e, se a etiqueta sorteada não for a do IAGO, desfazer/não gravar o vínculo (a fila ainda avança).
- Migração: ajustar `public.atribuir_atendente_rodizio(uuid)` com um parâmetro opcional `p_somente_ia boolean default false` (ou retorno sem inserção quando o escolhido não é IAGO), preservando o avanço do ponteiro da fila.
- Sem novo cron, polling ou canal Realtime — nenhum impacto de custo.
