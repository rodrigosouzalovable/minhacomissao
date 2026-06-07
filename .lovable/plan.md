## Diagnóstico

O erro continua vindo do **Storage**, antes de chamar a função `estrategia-importar`.

O request atual confirma:
- Usuário autenticado: `rodrigo.rs2013@gmail.com`
- ID: `ee649720-b8ce-47a2-859e-100a3a9ae6bb`
- `is_admin_user(...) = true`
- `has_estrategias_access(...) = true`
- Mesmo assim o Storage retorna: `new row violates row-level security policy`

A policy de envio está correta para `INSERT`, mas o frontend usa:

```ts
.upload(storagePath, file, { upsert: true })
```

No Storage, `upsert: true` pode exigir permissões extras de leitura/atualização além do envio, mesmo quando o caminho é novo. Como o caminho já usa timestamp e não precisa sobrescrever arquivo, o `upsert` é desnecessário e está mantendo o bloqueio.

## Correção

1. **Frontend**
   - Alterar o upload em `src/pages/Estrategias.tsx` de `upsert: true` para `upsert: false`.
   - Isso faz o Storage executar somente o fluxo de criação do arquivo, usando a policy de envio que já retorna `true` para o Rodrigo.

2. **Backend/Storage**
   - Manter o bucket privado.
   - Manter a policy atual de `INSERT` para usuários com acesso a Estratégias.
   - Não abrir leitura pública.

3. **Edge Function**
   - Manter a checagem `has_estrategias_access`, já ajustada e publicada.

## Validação

- Confirmar que a linha do upload ficou sem `upsert: true`.
- Conferir novamente as policies de Storage.
- Depois você testa o envio; se passar do upload e aparecer outro erro, ele será da importação/processamento, não mais permissão de Storage.