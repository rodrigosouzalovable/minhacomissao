# Layout UAZAPI (Modelo Mensagem)

Nova terceira aba na página **Modelo Mensagem**, ao lado de "Colar imagem" e "Layout Planilha", para injetar nossos próprios números da UAZAPI dentro da planilha de campanha.

## Fluxo

1. **Importar planilha** (.xlsx/.xls) — qualquer layout. A planilha de exemplo tem 4 colunas (nome, telefone, valor, código) e 1.584 linhas, sem cabeçalho.
2. **Selecionar a coluna dos telefones** num seletor, com amostra dos primeiros valores de cada coluna para facilitar a escolha (a detecção sugere automaticamente a coluna que parece telefone).
3. **Intervalo de inserção** ajustável (padrão 10): a cada 10 linhas de clientes, o sistema insere uma linha extra com um número nosso conectado na UAZAPI.
4. **Gerar** — monta a planilha final:
   - Linha inserida = cópia da linha imediatamente acima, com apenas a coluna de telefone trocada pelo número da UAZAPI (assim todas as demais colunas/variáveis continuam preenchidas e o sistema de campanha lê a planilha inteira).
   - Os números da UAZAPI entram em rodízio (round-robin): 1º, 2º, 3º… e ao acabar a lista volta ao começo.
5. **Pré-visualização** em tabela, com as linhas inseridas destacadas (fundo/borda de destaque + selo "UAZAPI") e contador: total de linhas, quantos números nossos foram inseridos, quais números foram usados e quantas vezes cada um.
6. **Baixar Excel** — exporta exatamente as mesmas colunas da planilha original, já com as linhas injetadas nas posições certas.

Se nenhuma instância UAZAPI ativa com telefone cadastrado for encontrada, a aba avisa e orienta a preencher o telefone na aba UAZAPI → Configurações.

## Detalhes técnicos

- Novo componente `src/components/modelo-mensagem/LayoutUazapiTab.tsx`.
- `src/pages/ModeloMensagem.tsx`: adiciona a terceira `TabsTrigger`/`TabsContent` "Layout Uazapi" (mesma condição de admin já usada hoje).
- Números: consulta `user_whatsapp_instances` (`id, nome, telefone, ativo`) do usuário logado, filtrando `ativo = true` e `telefone` não vazio, ordenado por `ordem`. Somente leitura — nenhuma mudança de schema, envio, rodízio de campanha ou webhook.
- Leitura/escrita do arquivo com a lib `xlsx` já presente (`sheet_to_json { header: 1 }` → `aoa_to_sheet`), mantendo largura de colunas e download client-side.
- Telefones normalizados só para exibição/gravação (dígitos); o valor gravado na célula segue como texto para não perder zeros.
- Sem impacto de custo no Lovable Cloud: uma única consulta leve de leitura, nada de cron, polling ou Realtime.
