

## Importação em Background (Continua Mesmo ao Fechar a Página)

### Problema
Hoje toda a importação roda no navegador. Se você fechar a aba ou sair da conta, o processo para.

### Solução
Mover o processamento para uma **função backend** que roda no servidor. O fluxo será:

1. **Frontend**: Lê os arquivos Excel no navegador, faz o parse (como já faz hoje), e envia os dados parseados para a função backend
2. **Backend**: Recebe os dados e insere no banco em lotes — independente do navegador
3. **Acompanhamento**: Uma tabela `importacao_jobs` registra o progresso de cada arquivo, e o frontend consulta o status em tempo real

### Mudanças

#### 1. Nova tabela `importacao_jobs`
Registra cada job de importação com status e progresso:
- `id`, `user_id`, `nome_arquivo`, `credor`, `layout`
- `status`: `pendente` | `processando` | `concluido` | `erro`
- `total_registros`, `registros_inseridos`, `erro_mensagem`
- `dados_json` (JSONB): os dados parseados enviados pelo frontend
- `criado_em`, `atualizado_em`

#### 2. Nova Edge Function `process-import-job`
- Recebe o `job_id`, lê os dados da tabela `importacao_jobs`
- Insere os registros no banco em lotes de 500 (mesma lógica atual)
- Atualiza `registros_inseridos` e `status` conforme avança
- Cria o registro na tabela `importacoes` (histórico) ao concluir
- Usa `service_role_key` para inserções sem RLS

#### 3. Mudanças no Frontend (`ImportarDevedores.tsx`)
- **Parse**: Continua no navegador (lê Excel, converte em JSON)
- **Ao clicar "Importar"**: Salva os dados parseados na tabela `importacao_jobs` e chama a Edge Function (fire-and-forget)
- **Polling**: A cada 3 segundos, consulta `importacao_jobs` para atualizar a barra de progresso
- **Multi-arquivo**: Cada arquivo vira um job independente — todos são enviados de uma vez
- Se o usuário fechar e voltar, verá os jobs em andamento ou concluídos

#### 4. UI de acompanhamento
- Card "Importações em Andamento" aparece quando há jobs ativos
- Mostra cada arquivo com status (Pendente → Processando → Concluído/Erro)
- Progress bar com contagem de registros inseridos
- Jobs concluídos ficam visíveis por 24h depois somem

### Fluxo visual

```text
[Usuário seleciona arquivos]
        ↓
[Browser parse XLSX → JSON]
        ↓
[Salva JSON em importacao_jobs]
        ↓
[Chama Edge Function (fire-and-forget)]
        ↓
[Edge Function insere no banco em lotes]
        ↓                    ↓
[Atualiza progresso]   [Usuário pode fechar]
        ↓
[Frontend faz polling e mostra status]
```

### O que NÃO muda
- Lógica de parsing de cada layout (permanece no frontend)
- Tabelas existentes (`devedores`, `importacoes`, `acordos`, `pagamentos`)
- Funciona mesmo com um único arquivo

### Custo
- Uma Edge Function adicional (custo mínimo, executa só durante importação)
- Tabela `importacao_jobs` com dados temporários (JSONB é limpo após conclusão)

