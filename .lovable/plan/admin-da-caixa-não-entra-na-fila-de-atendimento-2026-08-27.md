# Admin da caixa não entra na fila de atendimento

## O que foi verificado no banco

Na caixa **AMARAL NM** os responsáveis são: Bruno (**Admin**), Gabriel, Lais, Poliana e Rebeca Amaral (sem admin). Hoje o rodízio considera **todos os membros da caixa**, sem olhar a marca de Admin — por isso Bruno está recebendo conversas.

Outras caixas do Thiago hoje: **AMARAL** (Gabriel, Lais e Poliana marcados como Admin; Thiago e Rebeca não) e **AQUECIMENTO AMARAL** (só Thiago, como Admin).

## O que será feito

- Quem está marcado como **Admin da caixa** deixa de participar do rodízio automático de atendimento daquela caixa: não recebe mais conversas nem etiqueta automática de atendente. Continua vendo e acompanhando todas as conversas da caixa e podendo gerenciar os atendentes.
- Isso vale nos dois caminhos automáticos: o rodízio circular do banco e a atribuição feita pelo webhook quando o cliente responde.
- Se o admin da caixa responder **manualmente** uma conversa, ele continua podendo ficar vinculado a ela (etiqueta de envio manual) — a regra bloqueia apenas a distribuição automática.
- Proteção contra caixa vazia: se **todos** os responsáveis de uma caixa estiverem marcados como Admin (caso de AQUECIMENTO AMARAL hoje), o rodízio volta a considerá-los, para nenhuma conversa ficar sem atendente. Nas caixas com pelo menos um atendente não-admin, os admins ficam de fora.
- No diálogo "Atendentes da caixa", o admin passa a exibir a indicação de que ele apenas acompanha (não entra na fila), em vez do selo "fora da fila".

Efeito prático imediato: em AMARAL NM as conversas passam a se distribuir entre Gabriel, Lais, Poliana e Rebeca; em AMARAL, entre Thiago e Rebeca.

## Detalhes técnicos

- Migração: em `atribuir_atendente_rodizio`, o CTE `elegiveis` passa a excluir membros com `admin = true` (`meta_inbox_folder_members` para caixa criada, `meta_inbox_default_members` para a Padrão), com fallback: se o conjunto resultante for vazio, considerar todos os membros (regra de caixa 100% admin).
- `supabase/functions/meta-whatsapp-webhook/index.ts` (~linha 724): ao montar `permitidosCaixa`, ler também a coluna `admin` e não incluir os membros admin; manter o fallback de incluir todos quando o conjunto ficar vazio.
- `supabase/functions/_shared/etiqueta-atendente.ts`: mantido como está (fluxo manual).
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx`: quando `admin` estiver marcado, mostrar o rótulo "só acompanha" e suprimir o selo "fora da fila" daquela linha.
- Sem cron, polling ou Realtime novos — nenhum impacto de custo.
