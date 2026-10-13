# Corrigir campanha que falhou por quebra de linha nas variáveis

## O que aconteceu (confirmado nos registros)
As duas mensagens (Rodrigo e Stela) não falharam por falta de instância. A Meta recusou as duas, nas 3 tentativas e nas 3 instâncias testadas, com o erro **#132018: "Param text cannot have new-line/tab characters or more than 4 consecutive spaces"**.

A variável {{3}} da planilha tem quebras de linha (os 3 itens com ✅ e a linha em branco). A Meta não aceita quebra de linha dentro de variável, em nenhuma instância. Trocar de instância não resolve: qualquer instância receberia o mesmo erro.

## O que vai mudar
1. **Ajuste automático do texto antes do envio**: quebras de linha, tabs e espaços repetidos dentro das variáveis viram um separador simples (" • " entre itens), para a Meta aceitar. Ex.: "✅ Portabilidade... • ✅ Saque... • ✅ Dinheiro... • Quer ver quanto consegue economizar?"
2. **Aviso na importação e na prévia**: ao importar a planilha, o sistema avisa que as quebras de linha das variáveis serão juntadas em uma linha, e a prévia já mostra o texto como vai chegar.
3. **Erro de conteúdo não é culpa da instância**: o erro #132018 (e erros parecidos de parâmetro) deixa de contar como falha da instância. As instâncias não são mais "queimadas" por esse motivo, e o contato mostra a mensagem clara: "Texto da variável inválido para a Meta".
4. **Tentar novamente** nesta campanha passa a funcionar para os dois contatos, já com o texto ajustado.

Observação: se você quiser os itens em linhas separadas, isso só é possível colocando-os no texto fixo do template (aprovado pela Meta), não na variável.

## Detalhes técnicos
- Sanitização central em `_shared/send-whatsapp-meta-handler.ts` nos parâmetros de corpo/cabeçalho: `\r\n|\n|\t` → " • ", colapsar 4+ espaços, trim. Mesma função compartilhada no frontend (`src/lib/metaTemplateVariables.ts`) para prévia e aviso no `MapearColunasImportDialog`.
- Classificar 132018/132000/132012 como erro de conteúdo em tick/burst: não incrementar `falhas_por_instancia_run`, não rotacionar instância, marcar item com erro final sem 3 tentativas.
- Testes: sanitização (quebras, tabs, espaços) e classificação de 132018 como não-instância.
- Sem novo cron/polling; custo inalterado.
