

## Adicionar Template "Genérico Vencido" (Fallback) no Configurador de Lembretes

### Problema
Quando o usuário tenta enviar áudio para um lembrete cujo dia de atraso exato (ex: D+5) não tem template configurado, aparece "Nenhum áudio configurado para este tipo de lembrete". Falta um template fallback para cobrir dias não configurados individualmente.

### Solução
Adicionar uma nova aba fixa chamada **"Vencido (genérico)"** no configurador de Mensagens de Lembrete. Esse template será usado como fallback quando não existir um template específico para o dia de atraso exato.

### Alterações

**Arquivo: `src/components/LembreteMensagensDialog.tsx`**
1. Adicionar um novo tipo fixo em `BASE_TIPOS` com key `vencido_generico`, label "Vencido (genérico)" e descrição "Usado quando não há template específico para o dia de atraso"
2. Adicionar mensagem padrão em `DEFAULT_MESSAGES` para `vencido_generico`
3. Posicionar essa aba no final da lista (ordem 9999)

**Arquivo: `src/components/PaymentReminders.tsx`**
1. Na lógica de envio de áudio (linha ~355), quando `templates.find(t => t.tipo_lembrete === tipoKey)` não encontra template com áudio, buscar fallback em `templates.find(t => t.tipo_lembrete === 'vencido_generico')`
2. Aplicar a mesma lógica de fallback para o envio de mensagem de texto

### Detalhes técnicos
- Nenhuma migração necessária — a coluna `tipo_lembrete` é texto livre, basta inserir `vencido_generico`
- O fallback só se aplica a lembretes do tipo `vencido` (não afeta D-3 ou D-0)
- Se nem o template específico nem o genérico tiverem áudio, a mensagem de erro atual permanece

