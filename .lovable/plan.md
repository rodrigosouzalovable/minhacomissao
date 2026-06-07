O erro acontece antes da planilha ser processada: o navegador tenta gravar o arquivo no bucket privado `estrategia-uploads`, mas a política de segurança do Storage está recusando a criação do arquivo (`new row violates row-level security policy`).

Pelo que verifiquei, a política atual exige três coisas ao mesmo tempo:

```text
bucket = estrategia-uploads
usuário logado é admin
primeira pasta do arquivo = id do usuário logado
```

Ou seja, se qualquer uma dessas condições não bater exatamente no token da sessão atual, o upload é bloqueado. A tela mostra o botão porque o frontend reconhece o usuário como admin, mas o Storage valida de novo no backend e está barrando a linha do arquivo.

Plano de correção:

1. Ajustar a política do bucket `estrategia-uploads`
   - Permitir upload para usuários autenticados que sejam admin.
   - Manter o bucket privado.
   - Evitar depender da comparação frágil da primeira pasta com `auth.uid()` se ela estiver causando incompatibilidade.

2. Reforçar a segurança no fluxo da função de importação
   - A Edge Function já valida se o usuário é admin antes de processar.
   - O arquivo continuará sendo lido pelo backend com chave segura e removido ao final.

3. Melhorar a mensagem de erro na tela
   - Trocar o erro técnico `new row violates row-level security policy` por uma mensagem clara, por exemplo: `Sem permissão para enviar esta planilha. Faça login como admin e tente novamente.`
   - Isso ajuda a diferenciar erro de permissão, erro de arquivo e erro de processamento.

4. Validar após a mudança
   - Confirmar que existe política `INSERT` no Storage para `estrategia-uploads`.
   - Confirmar que o bucket continua privado.
   - Confirmar que o upload deixa de falhar nessa etapa e passa para o processamento em segundo plano.

Não há aumento de custo de Lovable Cloud nesta correção.