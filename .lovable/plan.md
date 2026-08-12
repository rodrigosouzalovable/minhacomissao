# IAGO na fila de atendimento + proposta igual ao portal

## Por que nenhum cliente cai para o IAGO (confirmado no banco e no código)

O IAGO está tudo certo no cadastro:

- Perfil ativo: "Iago Ribeiro de Souza".
- Permissão "Atende no Inbox Meta Oficial" ligada.
- Marcado como atendente da caixa Padrão.
- Registro ativo na fila de atendimento (ordem 23).
- Etiqueta "Atendente: Iago Ribeiro de Souza" criada.

O problema é a **dona da etiqueta**. Todas as instâncias da Meta pertencem ao login do admin, e o webhook busca as etiquetas de atendente **somente do dono da instância**. A etiqueta do IAGO foi criada no nome do próprio usuário IAGO, então ela simplesmente não entra na lista de candidatos do rodízio — ele nunca é sorteado. Nos últimos 3 dias, 5 atendentes receberam ~115 conversas cada e o IAGO recebeu 1 (essa 1 veio por outro caminho, não pelo rodízio).

O mesmo defeito afeta outras etiquetas criadas fora do login admin (Andreia, Bruno, Cacilda, Diego, Lorena, Marcia, Mayara, Henrique, Alexander, Guilherme). Se um dia você marcar essas pessoas numa caixa, elas também ficariam de fora.

## O que será feito

### 1. IAGO entra no rodízio de verdade
- A lista de etiquetas de atendente passa a ser considerada por **nome do atendente**, não pela dona da etiqueta — resolve o IAGO e qualquer outra etiqueta criada por outro login.
- Regra final de elegibilidade continua a mesma para todos: estar marcado em "Atendentes desta caixa" + permissão de atendimento ligada + fila ativa.
- Consequência direta: desmarcar o IAGO da caixa o tira da fila na hora; marcar de volta o recoloca. Nada de tratamento especial para ele.
- Correção retroativa: normalizar a dona das etiquetas de atendente para o login que possui as instâncias, para que a fila e o rodízio leiam todas.

### 2. Proposta do IAGO = proposta do portal
Hoje o IAGO usa percentuais fixos da configuração da IA (50% à vista / 30% parcelado). O portal usa **faixa de dias de atraso** e, quando existe, a **tabela de descontos do credor**.

- O cálculo do IAGO passa a usar exatamente as mesmas regras do portal: dias de atraso da parcela mais antiga, faixas customizadas do credor quando cadastradas, senão as faixas padrão (até 200d 10%/0%, 201–300 20%/10%, 301–500 30%/20%, acima de 500 50%/30%).
- Parcelamento seguindo o portal: até 24x, parcela nunca menor que R$ 100,00.
- Ele sempre apresenta as **duas opções**: à vista com desconto e parcelado, com valor da parcela.
- Continua proibido inventar valores: todo número vem do sistema.

### 3. Tom de voz
- Ajuste da personalidade: cordial, profissional, sem gírias, sem emoji em excesso, sem se identificar como robô, mensagens curtas e objetivas.

### 4. Aprendizado com as conversas do dia
- Garantir que a rotina de aprendizado rode diariamente lendo as negociações reais que terminaram em acordo lançado e gravando os padrões que funcionaram como base de conhecimento do IAGO (visível e desativável na aba "Aprendizado" do painel dele).

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts`: remover o filtro `.eq('user_id', inst.user_id)` na leitura de `meta_whatsapp_etiquetas` "Atendente:%" (passar a carregar todas do tenant e deduplicar por nome), mantendo `permitidosCaixa` + `atende_inbox_meta` + `meta_atendimento_fila.ativo` como única regra de elegibilidade.
- Migração: `UPDATE meta_whatsapp_etiquetas SET user_id = <dono das instâncias> WHERE nome ILIKE 'Atendente:%'` (ou índice único por nome+tenant) para evitar etiquetas duplicadas por login.
- `supabase/functions/_shared/iago.ts` → `calcularProposta`: trocar os percentuais de `meta_ia_config` pelo cálculo do portal — dias de atraso via vencimento mais antigo de `consultar_debitos_por_cpf`, faixas via `credor_desconto_faixas` (normalizando o nome do credor) com fallback nas faixas padrão; grade de parcelas até 24x respeitando parcela mínima R$ 100.
- `iago_config.tom` / `instrucoes_gerais`: atualizar para o tom cordial e profissional pedido, sem gírias, sempre ofertando à vista e parcelado.
- `iago-aprender`: confirmar/recriar o agendamento diário e checar se está gravando `iago_conhecimento` com tipo `aprendizado`.
