

## Plano: Campo de Horário no Retorno + Popup de Lembrete Global

### O que será feito

1. **Adicionar campo de horário ao formulário de retorno** (Retornos.tsx)
   - Ao lado do campo "Data de Retorno", adicionar um `<Input type="time">` para selecionar o horário
   - Adicionar `horaRetorno` ao estado do formulário
   - Concatenar data + hora ao salvar no banco (campo `data_retorno` já é string, salvar como `YYYY-MM-DDTHH:MM`)

2. **Alterar coluna `data_retorno` no banco** 
   - Atualmente é `date` — precisa aceitar timestamp. Migração SQL: `ALTER TABLE retornos ALTER COLUMN data_retorno TYPE timestamptz USING data_retorno::timestamptz;`
   - Isso permite armazenar data e hora juntos

3. **Criar componente global de notificação de retorno** (novo: `src/components/RetornoAlertChecker.tsx`)
   - Componente montado no `AppLayout` (presente em todas as páginas protegidas)
   - A cada 30 segundos, consulta `retornos` do usuário logado onde `data_retorno` está dentro dos próximos 1-2 minutos e `status = 'pendente'`
   - Quando encontrar um retorno agendado para o horário atual, exibe um `AlertDialog` no centro da tela com os dados do cliente e toca o som de notificação
   - Marca o retorno como "notificado" (via campo local ou update no status) para não repetir o alerta

4. **Atualizar exibição** nas listagens de retornos para mostrar a hora junto da data

### Detalhes Técnicos

- **Migração SQL**: Alterar tipo da coluna `data_retorno` de `date` para `timestamptz`
- **Novo componente**: `RetornoAlertChecker` com `setInterval` de 30s, montado dentro de `AppLayout`
- **Arquivos modificados**: `Retornos.tsx` (formulário + listagem), `AppLayout.tsx` (montar checker), novo componente
- **Som**: Reutilizar `success-sound.mp3` já existente no projeto

