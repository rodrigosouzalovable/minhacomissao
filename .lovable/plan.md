## Diagnóstico

O problema real já apareceu no banco do último envio: os CNPJs estão sendo salvos na coluna `nome`, enquanto a coluna `cpf` está vazia. Exemplo do job recente:

```text
telefone: 5571996560037
nome: 67853380000188
cpf: vazio
```

Por isso o template recebe `{cpf}` vazio e a mensagem sai como `CNPJ {}`.

## Plano de correção urgente

1. **Corrigir a importação quando só existirem 2 colunas numéricas**
   - Na tela de mapeamento, detectar melhor colunas com CNPJ de 14 dígitos.
   - Se a planilha tiver formato `telefone, cnpj`, a segunda coluna deve ser automaticamente `CPF / CNPJ`, nunca `Nome`.
   - Ajustar a heurística atual que confunde CNPJ com telefone porque aceita 10 a 13 dígitos como telefone antes de testar CNPJ.

2. **Adicionar uma proteção antes de confirmar a importação**
   - Ao confirmar, se a coluna marcada como `Nome` tiver valores de CPF/CNPJ e a coluna `CPF / CNPJ` estiver vazia, o sistema vai avisar e impedir a importação.
   - Mensagem clara: “A coluna B parece ser CPF/CNPJ. Marque como CPF / CNPJ para preencher a variável {cpf}.”

3. **Mostrar o CNPJ no preview dos destinatários**
   - Hoje o preview só mostra telefone e nome, então o erro passa despercebido.
   - Alterar para exibir: `Primeiro: telefone • CNPJ/CPF: 67853380000188` quando existir `cpf`.
   - Assim você consegue validar antes de disparar.

4. **Corrigir o editor de variáveis para templates de múltiplas instâncias**
   - O envio usa um template por instância, mas o botão “Editar variáveis” hoje salva só no template de exemplo.
   - Atualizar para salvar o mapeamento `{cpf}` em todas as linhas aprovadas do mesmo template/idioma nas instâncias selecionadas.
   - Isso evita uma instância mandar correto e outra continuar com variável errada.

5. **Criar fallback anti-erro no envio**
   - No backend de envio, se `{cpf}` vier vazio mas `nome` contiver um CPF/CNPJ numérico de 11 ou 14 dígitos, usar esse valor como CPF/CNPJ.
   - Isso protege envios mesmo quando uma planilha foi importada/mapeada errado.

6. **Verificação final**
   - Testar com o arquivo enviado no formato:
     ```text
     5571996560037, 67853380000188
     ```
   - Confirmar que a importação gera:
     ```text
     telefone: 5571996560037
     cpf: 67853380000188
     nome: vazio
     ```
   - Confirmar que o corpo renderizado troca `{{1}}`/`{cpf}` por `67853380000188`, sem aparecer `{}`.

## Arquivos a alterar

- `src/components/meta/MapearColunasImportDialog.tsx`
- `src/components/meta/EditarVariaveisTemplateDialog.tsx`
- `src/pages/EnvioMeta.tsx`
- `supabase/functions/send-whatsapp-meta/index.ts`

## Fora do escopo

- Sem criar tabela nova.
- Sem cron novo.
- Sem polling/realtime novo.
- Sem aumento de custo de backend.