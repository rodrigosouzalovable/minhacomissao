# Modelo UME (aba Modelo Mensagem)

Nova aba **Modelo UME** na página Modelo Mensagem (visível para admin, junto das outras abas) para limpar planilhas de acionamento da UME.

## Fluxo

1. **Importar planilha** (.xlsx/.xls) no mesmo formato do anexo: coluna A = nome, coluna B = telefone, coluna C = tempo de atraso (dias). Cabeçalho, se houver, é detectado e ignorado.
2. O sistema analisa a coluna A e **remove a linha inteira** de todo nome "estranho".
3. **Pré-visualização** em duas partes:
   - Tabela com as linhas aprovadas (Nome | Telefone | Atraso).
   - Contadores: total importado, mantidas, removidas — com uma lista das removidas para conferência.
4. **Baixar Excel** com apenas as linhas limpas: A = nome, B = telefone, C = atraso.
5. **Limpar** para descartar a importação.

## Regra de nome inválido

Um nome é descartado quando contém:
- Letras acentuadas ou caracteres fora de A–Z (ex.: `Josã©`, `Rosã¡Rio`, `Ã`, `©`, `¡`) — no anexo esses são justamente os nomes corrompidos.
- Qualquer símbolo que não seja letra, espaço, apóstrofo ou hífen (ex.: `?`, `#`, `*`, `_`, `�`, números no meio do nome).
- Nome vazio, com menos de 2 caracteres ou sem sobrenome (uma única palavra).

Linhas sem telefone válido (menos de 10 dígitos) também são descartadas, e telefones duplicados são consolidados mantendo o menor tempo de atraso.

## Detalhes técnicos

- Novo componente `src/components/modelo-mensagem/ModeloUmeTab.tsx`, seguindo o padrão de `LayoutPlanilhaTab.tsx` (leitura/escrita com a lib `xlsx`, tudo client-side, sem backend).
- `src/pages/ModeloMensagem.tsx`: nova `TabsTrigger`/`TabsContent` com valor `ume` e rótulo "Modelo UME".
- Detecção via normalização Unicode (`normalize('NFD')`) + regex de caracteres permitidos, cobrindo tanto acentos reais quanto mojibake.
- Nenhuma mudança de banco de dados.
