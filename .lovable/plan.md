

## Upload Múltiplo de Planilhas com Importação Sequencial

### O que será feito

Transformar o campo de upload para aceitar **múltiplos arquivos** de uma vez. Ao clicar em "Importar", o sistema processará e importará cada arquivo sequencialmente (um após o outro), mostrando progresso global e por arquivo.

### Mudanças no `src/pages/ImportarDevedores.tsx`

#### 1. Estado para múltiplos arquivos
- Substituir `file: File | null` por `files: File[]` (lista de arquivos)
- Adicionar estado `currentFileIndex` para controlar qual arquivo está sendo processado
- Adicionar estado `fileResults: { name: string, status: 'pending' | 'processing' | 'done' | 'error', count: number, error?: string }[]` para mostrar resultado de cada arquivo

#### 2. Input com `multiple`
- Adicionar `multiple` ao `<Input type="file" />` para permitir seleção de vários arquivos
- Mostrar lista dos arquivos selecionados com nome e tamanho
- Botão "Limpar" remove todos os arquivos

#### 3. Botão "Importar Todos"
- Um único botão que inicia o processo sequencial
- Para cada arquivo na fila:
  1. Lê e parseia o arquivo (usa a lógica existente de `handleFile`)
  2. Executa a importação (usa `handleImport` / `handleImportUmeAporte` / etc. conforme o layout)
  3. Marca como concluído e avança para o próximo
- Progress bar global mostrando "Arquivo 2 de 5" + progress bar individual do arquivo atual

#### 4. UI de progresso
- Lista visual dos arquivos com status:
  - ⏳ Pendente (cinza)
  - 🔄 Processando (azul, com spinner)
  - ✅ Concluído (verde, com contagem de registros)
  - ❌ Erro (vermelho, com mensagem)
- Se um arquivo der erro, o sistema pula para o próximo (não trava tudo)
- Botão "Parar" para interromper a fila

### O que NÃO muda
- Toda a lógica de parsing e importação existente permanece intacta
- Layouts, credores, banco de dados — nada muda
- Funciona igualmente com upload de arquivo único (comportamento retrocompatível)

