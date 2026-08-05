# Relatório de Acionamentos automático (hora em hora)

Objetivo: a aba **Relatórios** deixa de depender de cliques manuais. A cada hora o sistema lê os envios e respostas do Inbox Meta Oficial e os acordos lançados, grava na linha da hora correspondente e mostra tudo em um painel visual no estilo dos exemplos do chefe (funil Acionamentos → Interações → CPC → CPC-A → Acordos).

## Regras acordadas

- **WHATSAPP** = mensagens de saída pelo Inbox Meta na faixa da hora (contagem de clientes distintos acionados).
- **TENTATIVAS** = total de acionamentos da hora (WhatsApp + ligações da 3C Plus quando a integração existir).
- **CPC** = cliente respondeu (mensagem de entrada) naquela hora, contando cada telefone uma vez por dia.
- **CPC-A** = telefone que respondeu e teve acordo lançado no mesmo dia.
- **$ ACORDOS** = soma dos acordos criados na faixa da hora (já existe hoje via gatilho).
- Edição manual continua permitida: o valor automático nunca sobrescreve um ajuste feito por admin naquela coluna/hora.

## O que muda na tela

1. **Cabeçalho novo com funil visual** (cards + barras percentuais), acima da tabela:
   - Acionamentos, Interações (respostas), CPC, CPC-A, Boletos/Acordos e valor total.
   - Taxa de interação (Interações ÷ Acionamentos) e taxa de conversão (Acordos ÷ Interações), com as barras coloridas dos exemplos.
   - Selo "PARCIAL — dd/MM" e horário da última atualização automática.
2. **Tabela por hora mantida**, com destaque de origem: número em cinza = automático, com ícone quando houve ajuste manual.
3. **Botão "Atualizar agora"** para forçar o recálculo da hora corrente sem esperar o cron.
4. **Botão "Baixar imagem do resumo"** (opcional de uso) para encaminhar o card pronto.

## Automação

- Nova função agendada `relatorio-acionamentos-sync`, roda a cada hora (08h–19h BRT): calcula WhatsApp/CPC/CPC-A da hora fechada, grava na tabela `relatorio_acionamentos` e envia o **resumo parcial no WhatsApp** para 62991672674 e 62994300880.
- **Resumo consolidado do dia às 19h30 BRT**, com o funil completo e ranking de valores.
- Mensagens usam controle de idempotência por dia+hora, então reexecução não duplica envio.

## 3C Plus (ligações)

A parte de CPC por ligação fica preparada mas inativa até a API oficial da 3C Plus estar disponível. Nesta etapa: colunas de origem separadas (`whatsapp` automático vs `tentativas` totais) e um ponto único no código para plugar o import da 3C. Quando você tiver as credenciais, criamos o conector que puxa o relatório e soma nas mesmas linhas de hora.

## Detalhes técnicos

- Novas colunas em `relatorio_acionamentos`: `whatsapp_auto`, `cpc_auto`, `cpca_auto`, `tentativas_auto`, `sync_em`, e flags `*_manual` para proteger edições. GRANTs e RLS seguindo o padrão atual (leitura autenticada, escrita admin, escrita da função via service role).
- Fontes de dados: `meta_whatsapp_mensagens` (`direcao`, `telefone`, `timestamp_msg`) e `acordos` (`criado_em`, `cliente_telefone`, `cliente_cpf`, `valor_total`). Casamento telefone→acordo pelo sufixo de 8 dígitos, conforme padrão do projeto.
- Alerta de custo: a função roda 12x/dia com consultas agregadas por faixa de hora e índice em `(timestamp_msg, direcao)`; impacto estimado baixo (~12 execuções curtas/dia, sem polling novo no cliente). O Realtime já existente na tela é reaproveitado, sem novo canal.
- Frontend: novo componente `src/components/relatorios/FunilAcionamentosCard.tsx` + ajustes em `src/pages/Relatorios.tsx`, usando apenas tokens semânticos do design system.
