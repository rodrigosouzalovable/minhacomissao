# Manter nossos números UAZAPI mesmo repetidos no Envio Meta

Hoje, na aba Envio Meta, toda linha com telefone repetido é descartada em três pontos: no mapeamento do Excel (Destinatários → Importar Excel), na releitura do textarea e na deduplicação antes da validação/envio. Como o Layout Uazapi injeta o mesmo número nosso a cada 10 linhas, essas linhas são eliminadas — só a primeira sobrevive.

## O que muda

- O sistema passa a reconhecer os telefones das instâncias UAZAPI (números ativos com telefone cadastrado na aba UAZAPI) e os trata como **isentos de deduplicação**: todas as repetições são mantidas e recebem mensagem.
- Qualquer outro telefone repetido continua sendo removido como hoje.
- Os contadores/avisos passam a refletir só os duplicados realmente removidos; um aviso adicional informa quantas linhas de números nossos foram preservadas (ex.: "🔁 12 duplicado(s) removido(s) • 🟦 25 linha(s) de números UAZAPI mantidas").

## Detalhes técnicos

- Carregar uma vez na página `src/pages/EnvioMeta.tsx` a lista de telefones de `user_whatsapp_instances` (ativos, com telefone válido) e guardar como conjunto de sufixos de 8 dígitos (padrão de comparação de telefone do projeto).
- Repassar esse conjunto para as funções de dedup:
  - `parseRecipients` e `dedupRecipientsRaw` em `EnvioMeta.tsx` ganham um parâmetro opcional `isentos: Set<string>`; quando o sufixo do telefone estiver no conjunto, a linha é sempre mantida (sem `seen.has` bloqueando).
  - `src/components/meta/MapearColunasImportDialog.tsx` recebe a mesma prop e aplica a exceção no laço de mapeamento, retornando também `preservados` nas stats.
- `varsByTel` é indexado por telefone; para números isentos repetidos as variáveis da última ocorrência prevalecem (comportamento aceitável, pois são números nossos de teste/aquecimento). Nenhuma mudança de banco de dados é necessária.
