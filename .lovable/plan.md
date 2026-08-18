# IAGO: descontos próprios e espera extra de 20s

Duas mudanças no atendimento do IAGO nas conversas do Inbox Meta Oficial.

## 1. Descontos definidos por você

- Novos campos **% à vista** e **% parcelado** dentro de **Configurar IAGO** (aba Personalidade/Proposta), com os valores atuais como padrão (40% à vista / 30% parcelado, ajustáveis).
- Ao montar a proposta, o IAGO passa a usar esses percentuais em vez das faixas por dias de atraso/credor. Tudo o mais continua igual: base = total dos débitos reais, grade 2x, 4x, 8x, 12x, 16x, 20x, 24x, parcela mínima R$ 100 e, se nenhuma parcela alcançar R$ 100, envia só o à vista.
- Se os campos ficarem vazios, o cálculo cai no comportamento atual (faixas do credor).

## 2. Espera extra de 20 segundos + preferência para o humano

- Antes de responder, o IAGO passa a aguardar **20 segundos a mais** do que hoje.
- Ao fim dessa espera ele reconfere a conversa: se um atendente humano respondeu ao cliente nesse intervalo, o IAGO **não envia nada** (cancela o follow-up e apenas registra).
- A regra atual dos 10 minutos de silêncio após resposta humana continua valendo.

## Detalhes técnicos

Banco: adicionar `desconto_avista_pct` e `desconto_parcelado_pct` (numeric, nullable) em `iago_config`.

Backend:
- `supabase/functions/_shared/iago.ts`: `calcularProposta` aceita override opcional `{ descAvista, descParcelado }`; quando informado, ignora `credor_desconto_faixas`/faixas padrão.
- `supabase/functions/iago-atendimento/index.ts`: passa os percentuais de `iago_config` ao `calcularProposta`; após o `sleep(1000)` inicial, adiciona `await sleep(20000)` e, em seguida, uma nova checagem de saída humana (mensagem `saida` não pertencente ao IAGO criada depois do corte) — se houver, encerra sem responder (`followup_em: null`, `iago_finish_message`).
- `iago-followup-tick` não muda.

Frontend:
- `src/components/admin/IagoConfigDialog.tsx`: dois inputs numéricos (0–100) para os descontos, salvos em `iago_config`.

Custo: sem novos crons ou polling; apenas 20s a mais de execução por mensagem atendida.
