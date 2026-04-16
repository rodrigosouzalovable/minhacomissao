

## Corrigir Login Bloqueado Durante Importação em Lote

### Diagnóstico

O problema não é a importação em si, mas os **payloads enormes** de `dados_json` sendo inseridos na tabela `importacao_jobs`. Cada arquivo XLSX pode gerar megabytes de JSON. Com 14 arquivos, o navegador fica enviando requisições gigantes sequencialmente para o Supabase, esgotando o pool de conexões HTTP do browser (limite de ~6 conexões simultâneas por domínio). Quando você abre outra aba e tenta fazer login, a requisição de `signInWithPassword` fica na fila esperando uma conexão disponível.

### Solução

Dois ajustes para garantir que a importação não bloqueie o resto do sistema:

#### 1. Adicionar timeout no login (`src/pages/Auth.tsx`)
Envolver a chamada de `signIn` com um timeout para que nunca fique preso infinitamente no "Entrando...". Se demorar mais de 15 segundos, mostrar mensagem de erro pedindo para tentar novamente.

#### 2. Throttle nas inserções de jobs (`src/pages/ImportarDevedores.tsx`)
- Adicionar um pequeno `await new Promise(resolve => setTimeout(resolve, 500))` entre cada inserção de job para não saturar as conexões
- Mais importante: marcar o resultado como "done" (enviado ao servidor) imediatamente após a inserção, liberando o browser para outras operações

#### 3. Otimizar o tamanho do payload
- Remover campos desnecessários do `dados_json` antes de enviar (ex: campos vazios, metadados do XLSX)
- Isso reduz o tempo de upload de cada job

### Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Auth.tsx` | Timeout de 15s no login com mensagem amigável |
| `src/pages/ImportarDevedores.tsx` | Delay de 500ms entre jobs + limpeza de payload |

### O que NÃO muda
- Edge Function `process-import-job` permanece igual
- Tabela `importacao_jobs` não muda
- Toda lógica de parsing e importação continua a mesma

