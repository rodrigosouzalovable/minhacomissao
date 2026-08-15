# Qualificação: caixa mais compacta + IAGO qualificando sozinho

## 1. Caixa de qualificação cabendo na tela

Hoje a lista de qualificações cresce junto com a quantidade de itens e a caixa passa da altura da tela (o rodapé com o texto de ajuda e o botão "Gerenciar qualificações" fica cortado).

Mudanças visuais:
- A caixa passa a ter altura máxima limitada à tela (com uma folga), sempre cabendo inteira no monitor e no celular.
- Título e rodapé (texto de ajuda + botão de gerenciar) ficam fixos; só a lista de qualificações rola.
- Barra de rolagem discreta: fina, cinza translúcida, praticamente invisível até o mouse passar por cima. Vale também para as telas de motivos e de gerenciamento.
- Itens da lista um pouco mais compactos (menos altura por linha) para caber mais opções sem rolar.

Nada muda no comportamento: clique marca/desmarca, botão direito continua abrindo a configuração de motivos para admin.

## 2. IAGO qualificando as conversas que atende

O IAGO passa a escolher a qualificação da conversa por conta própria, usando as mesmas qualificações que os atendentes usam (as ativas cadastradas no sistema, com os motivos de cada uma).

Regras:
- Em cada atendimento dele, a IA recebe a lista de qualificações ativas (nome + motivos) e devolve qual se encaixa naquele cliente, junto com o motivo quando existir.
- Ele pode **trocar** a qualificação depois: se a conversa evoluir (ex.: de "Aguardando Resposta" para "Aguardando boleto" ou "Acordo Fechado"), ele substitui a anterior pela nova.
- Se ele não tiver certeza, não qualifica — deixa a conversa sem qualificação (borda vermelha) para o humano decidir. Nunca inventa qualificação nova.
- Situações já conhecidas do fluxo dele são aplicadas direto, sem depender do palpite da IA:
  - cliente fechou/aceitou a negociação → "Acordo Fechado"
  - cliente disse que não é a pessoa / número errado → "Não é o Cliente"
  - cliente mandou comprovante ou disse que já pagou → "Alega Pagamento" / "Já pagou"
  - cliente sem interesse ou pedindo para não receber mais contato → "Sem interesse"
  - Se alguma dessas qualificações não existir cadastrada, ele simplesmente não qualifica (não cria nada).
- Qualificação feita pelo IAGO aparece igual à do atendente na conversa e nos relatórios/exportações; o atendente pode alterar por cima a qualquer momento.

## Detalhes técnicos

Frontend — `src/components/inbox/meta/MetaQualificacaoDialog.tsx`:
- `DialogContent` com `max-h-[85svh]` + `flex flex-col`, corpo em `flex-1 min-h-0 overflow-y-auto`, rodapé fora da área de scroll.
- Classe utilitária de scrollbar discreta (`scrollbar-thin` custom) adicionada em `src/index.css` (`::-webkit-scrollbar` 6px, thumb `hsl(var(--muted-foreground)/0.25)`, hover 0.45, `scrollbar-width: thin` para Firefox). Substituir os `max-h-[45vh]` internos pelo container único.
- Padding dos itens de `py-2` para `py-1.5`.

Backend — `supabase/functions/iago-atendimento/index.ts` e `supabase/functions/_shared/iago.ts`:
- Nova função `qualificarConversa(supabase, contatoId, nomeQualificacao, nomeMotivo?)`: resolve nomes → ids em `meta_qualificacoes` (case-insensitive, só `ativo=true`), remove as qualificações anteriores marcadas pelo IAGO daquele contato e faz upsert em `meta_contato_qualificacao` (`user_id` = id do usuário IAGO, `onConflict: 'contato_id,qualificacao_id'`).
- `carregarQualificacoesDisponiveis`: lê primárias ativas + motivos ativos e injeta no prompt como lista fechada.
- Prompt do IAGO: novo campo no JSON de resposta `{"qualificacao":"","qualificacao_motivo":""}` com instrução de usar exatamente um nome da lista ou string vazia quando não tiver certeza.
- Após enviar as mensagens, aplicar a qualificação: primeiro as regras determinísticas (acordo fechado, número errado, comprovante, opt-out), senão o valor devolvido pela IA.
- Nenhuma tabela nova, nenhum cron novo, nenhuma chamada extra de IA — a qualificação sai na mesma resposta que o IAGO já gera. Sem impacto de custo.
