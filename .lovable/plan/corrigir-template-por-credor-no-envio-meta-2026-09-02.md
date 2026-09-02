# Corrigir template por credor no Envio Meta

## O que foi verificado

Na campanha "UME + NOVO MUNDO 5" (02/09, 12:51):

- A linha da cliente Francineide (final 0384) foi importada corretamente: o item no banco está com `credor = ume` e os valores de parcelamento da grade UME (18x de R$ 113,73).
- As duas variantes da campanha estão gravadas certas: `novo_mundo` → `autorizado_a_vista_ou_parcelado`, `ume` → `autorizado_a_vista_ou_parcelado_ume`, cada uma com o template aprovado em todas as instâncias (inclusive a que enviou, SOUZA 62 8269-1378).
- Mesmo assim a mensagem enviada foi a do template Novo Mundo ("seu débito com as Lojas Novo Mundo").
- Conferindo a campanha inteira, o resultado é praticamente aleatório: 8 clientes UME receberam o template Novo Mundo, 6 clientes Novo Mundo receberam o template UME. Ou seja, na prática valeu o revezamento (round-robin) e o credor da linha foi ignorado.

O código atual dos workers já contém a regra "credor da linha vence o round-robin", então o comportamento observado indica que a versão em execução não está aplicando essa regra (provável versão antiga publicada). Isso ainda não está confirmado — a primeira etapa é confirmar e, independente disso, tornar a regra à prova de falha.

## Correção proposta

1. **Definir o template na criação da campanha, não na hora do envio**
   Ao iniciar o envio, cada destinatário já recebe gravado o template correto do seu credor (por instância). Assim o envio não "decide" mais nada — ele só usa o que está gravado na linha.

2. **Trava de segurança no envio**
   Antes de disparar, o sistema compara o credor da linha com o credor do template escolhido. Se não bater, a mensagem **não** é enviada: a linha volta para a fila e o erro aparece na campanha. Nunca mais um cliente UME recebe layout Novo Mundo (e vice-versa).

3. **Auditoria por destinatário**
   Passa a ficar registrado em cada linha da campanha qual template foi realmente usado, para conferência imediata na tela da campanha (hoje só é possível descobrir olhando o histórico do Inbox).

4. **Aplicar nos dois modos de envio**
   Mesma regra no envio serial (30–90s) e no Modo Rajada.

5. **Publicar e validar**
   Republicar os workers e rodar um teste controlado com poucas linhas mistas (UME + Novo Mundo), conferindo no banco que cada credor recebeu o template correspondente antes de liberar campanha grande.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-iniciar/index.ts`: resolver `template_id` por item usando `template_variantes[].credor` + `template_id_by_instance` (no modo rajada a instância já é pré-atribuída; no serial, gravar o `template_variante_credor` do item para resolução determinística).
- Migração: adicionar em `envio_meta_job_item` as colunas `template_id_resolvido` e `template_nome_enviado` (com GRANTs conforme as políticas existentes da tabela).
- `envio-meta-massa-tick` e `envio-meta-massa-burst`: em `resolverTemplateId`, exigir correspondência de credor quando `item.credor` estiver preenchido e existir variante daquele credor; se o template daquele credor não existir na instância escolhida, escolher outra instância ou marcar erro `template do credor X indisponível` — nunca cair no fallback de outro credor.
- Gravar `template_nome_enviado` após o `send-whatsapp-meta` retornar sucesso.
- Exibir a coluna de template usado na lista de destinatários da campanha em `src/pages/EnvioMeta.tsx` / painel de itens.
- Reenvio dos 8 clientes UME que receberam o layout errado: opcional, decidir depois (a janela de 24h de vários já pode ter mudado).
