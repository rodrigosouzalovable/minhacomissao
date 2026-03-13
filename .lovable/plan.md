

# Plano: Permitir editar nome da instância QR Code

## Contexto
Instâncias criadas via QR Code recebem nome automático (ex: `user-ee649720-1773405529035`). O botão de editar já abre o formulário com nome, server_url e instance_token. O formulário já salva o nome no banco. **Não há risco de defeito** ao alterar apenas o nome — ele é um campo de exibição, não afeta a conexão.

## Mudança necessária

Apenas uma pequena alteração: quando o usuário clica em "Editar" numa instância conectada via QR Code, o formulário já aparece, mas os campos `server_url` e `instance_token` não devem ser editáveis (para evitar quebrar a conexão acidentalmente). O campo **Nome** deve ficar em destaque como editável.

### Arquivo: `src/pages/Acionamento.tsx`

No formulário de edição (linhas ~1602-1638):
- Quando `editingInstance.id` existe (edição), tornar `server_url` e `instance_token` como `readOnly` com estilo visual de campo desabilitado
- Manter o campo `Nome` totalmente editável
- Alterar o placeholder do nome para sugerir o número: `"Ex: 62981810202"`

Isso garante que o usuário pode renomear sem risco de alterar credenciais acidentalmente.

