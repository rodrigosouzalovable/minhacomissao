

## Plano: Botão "Reativar Todos"

### Situação atual

Já existe um botão "Forçar Reinício" no header da página (linha 200-204 do `Aquecimento.tsx`) que faz exatamente isso — muda todas as instâncias PAUSADO para EM_AQUECIMENTO. O botão só aparece quando há instâncias pausadas.

### O que será feito

1. **Renomear o botão** de "Forçar Reinício" para "▶ Reativar Todos" para ficar mais claro
2. **Adicionar confirmação** antes de reativar (dialog de confirmação para evitar cliques acidentais)
3. **Reativar as 21 instâncias pausadas agora** via update direto no banco de dados
4. **Adicionar botão "Reativar Todos"** também na seção de Pausados para maior visibilidade

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Aquecimento.tsx` | Renomear botão, adicionar confirmação, duplicar na seção pausados |
| Dados (UPDATE SQL) | Mudar status de PAUSADO → EM_AQUECIMENTO nas 21 instâncias |

