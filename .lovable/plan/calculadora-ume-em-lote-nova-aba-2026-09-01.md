# Calculadora UME em lote (nova aba)

Nova aba **Calculadora UME** (`/admin/calculadora-ume`, admin) para importar uma planilha de CPFs, consultar a calculadora da UME automaticamente e baixar o resultado em Excel.

## Como vai funcionar

1. **Importar planilha** (.xlsx/.xls/.csv): o sistema detecta a coluna de CPF (aceita com ou sem pontuação), ignora cabeçalho, descarta CPFs inválidos (≠ 11 dígitos) e remove duplicados. Mostra: total lido, válidos, inválidos, duplicados.
2. **Iniciar consulta**: cria um lote no servidor e o processamento roda em segundo plano, em ritmo controlado (pequenos grupos em paralelo, com pausa entre eles) para não sobrecarregar o relatório da UME.
3. **Acompanhamento**: barra de progresso com processados / total, encontrados, não localizados, erros e tempo estimado. Pode fechar a página e voltar depois — o lote continua registrado; um botão **Retomar** reinicia o processamento do que faltou.
4. **Reaproveitamento**: CPFs já consultados nas últimas 12h usam o cache existente, sem nova consulta (mais rápido e barato). Opção "forçar consulta nova" desmarcada por padrão.
5. **Baixar Excel** ao terminar (ou parcial, a qualquer momento):
   - A: CPF
   - B: Valor sem juros
   - C: Nome · D: Telefone · E: Dias de atraso · F: Fase · G: Limite total · H: Valor com juros · I: Situação (Encontrado / Não localizado / Erro)
6. **Histórico de lotes**: lista dos últimos lotes com data, quantidade, status e botão de baixar novamente.

## Regras

- CPF não localizado na UME entra no Excel com valor vazio e situação "Não localizado" — não quebra o lote.
- Erro pontual de consulta é repetido automaticamente até 3 vezes; persistindo, a linha fica como "Erro" e o lote segue.
- Se o layout do relatório UME mudar, o lote é pausado e o administrador é avisado pelo canal de notificação já existente (mesmo comportamento da calculadora individual), em vez de gerar valores errados.
- Nada muda na calculadora dentro da conversa nem no comportamento do IAGO.

## Detalhes técnicos

- Reutiliza `supabase/functions/_shared/ume-desconto.ts` (`consultarUme`) e o cache `ume_consultas_cache`.
- Banco (migração): `ume_lotes` (nome do arquivo, total, processados, encontrados, erros, status, criado_por) e `ume_lote_itens` (lote_id, cpf, status, valor_sem_juros, valor_com_juros, nome, telefone, dias_atraso, fase, limite_total, tentativas, erro). GRANTs + RLS: admin lê/gerencia tudo, dono lê os próprios; escrita de processamento pelo `service_role`.
- Edge functions novas: `ume-lote-iniciar` (grava itens e dispara o processamento) e `ume-lote-tick` (consome um bloco de pendentes e se auto-reencadeia até acabar). **Sem cron novo e sem polling agressivo** — o front consulta o progresso a cada 5s só enquanto a aba está visível, para manter o custo de Cloud baixo.
- Front: `src/pages/CalculadoraUme.tsx` + rota em `App.tsx` + item de menu em `AppLayout.tsx` (adminOnly); leitura/escrita de planilha com `xlsx` (lazy), exportação no padrão de `src/lib/exportExcel.ts`.
- Índices: `ume_lote_itens(lote_id, status)` para o claim dos pendentes ser eficiente em lotes de dezenas de milhares.
