# Corrigir o rodízio da fila de atendentes (Inbox Meta Oficial)

## O que foi verificado

Caixa **Padrão** tem 6 responsáveis, todos com etiqueta criada, registro **ativo** na fila e a permissão "Atende no Inbox Meta Oficial" ligada. A fila em si está correta.

O problema é o critério de escolha. Hoje o sistema escolhe o atendente com **menor número total de conversas de toda a história** (contagem acumulada desde o início), e não a próxima pessoa da ordem. Resultado real de hoje:

| Atendente | Conversas hoje | Total acumulado |
|---|---|---|
| Thailinny Nolasco | 39 | 95 |
| Yasmim Batista | 14 | 301 |
| Wallace Maciel | 10 | 281 |
| Anna Flavia | 4 | 268 |
| Fernanda Estock | 0 | 241 |
| Iago Ribeiro | 0 | 0 |

Quem entrou depois (Thailinny, Iago) tem total baixo, então recebe praticamente tudo até "empatar" com os 240-300 dos antigos — e Fernanda fica zerada. Não é rodízio, é nivelamento histórico.

## O que será feito

1. **Rodízio de verdade, por dia**
   - A escolha passa a considerar apenas as conversas atribuídas **no dia atual** (fuso de Brasília), não o acumulado histórico.
   - Critério: menor quantidade de conversas do dia; em caso de empate, segue a **ordem da fila** (`ordem` crescente). Assim a distribuição fica 1, 2, 3, 4, 5, 6, 1, 2, 3… e todo mundo recebe.
   - Todas as etiquetas de atendente atribuídas no dia contam como carga (automáticas e as aplicadas ao iniciar conversa), para não sobrecarregar quem já está atendendo muito.

2. **Mesma regra nos dois caminhos**
   - Aplicar o critério igual no webhook do Inbox Meta e no gatilho do banco, para não haver dois comportamentos diferentes.

3. **Regras mantidas**
   - Uma única etiqueta de atendente por conversa.
   - Prioridade continua sendo: acordo com o mesmo telefone → consulta de CPF no portal (7 dias) → atendente que iniciou a conversa → rodízio.
   - Só entram no rodízio os responsáveis daquela caixa, com permissão de atendimento ativa.

4. **Como conferir depois**
   - Uma consulta de acompanhamento mostrando as atribuições do dia por atendente, para validar que a distribuição fica equilibrada.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts` (bloco do rodízio, ~linhas 762-796): filtrar `meta_whatsapp_contato_etiquetas` por `criado_em >= início do dia BRT` ao montar `carga`; desempate por `ordem` da `meta_atendimento_fila` (carregar `etiqueta_id, ordem`) em vez de ordem alfabética do nome.
- Migração: recriar `atribuir_atendente_fila()` com a mesma lógica — subconsulta de contagem restrita a `ce.criado_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date` e `ORDER BY count ASC, ordem ASC`.
- Sem mudança em `meta_provisionar_atendentes_fila`, RLS, ou UI.
