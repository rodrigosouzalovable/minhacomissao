

# Plano: Remover botao alternativo e adicionar botao para novos dias

## Alteracoes em `LembreteMensagensDialog.tsx`

1. **Remover** o botao "Adicionar mensagem alternativa" (linhas 298-306) e toda logica de `addTemplate`/`removeTemplate` (multiplas mensagens por tipo)
2. **Remover** o botao de trash e a logica de templates multiplos por tipo
3. **Adicionar estado** `customTipos` para tipos personalizados criados pelo usuario
4. **Adicionar botao** "Adicionar novo dia" abaixo da lista de tipos na sidebar, com um mini-dialog/input para o usuario digitar o numero de dias (ex: 5, 15, 25, 45)
5. **Ao adicionar**, cria um novo tipo `vencido_dX` com label `D+X (X dias apos)` e template padrao generico
6. **Permitir remover** apenas os tipos customizados (os 8 originais nao podem ser removidos) - botao trash ao lado do tipo na sidebar
7. **Carregar tipos customizados do banco** - ao abrir, buscar tipos existentes que nao estao nos 8 pre-definidos e adiciona-los a lista
8. **Atualizar edge function** `check-payment-reminders` para reconhecer tipos customizados `vencido_dX` e calcular os dias dinamicamente a partir do sufixo

## Alteracao na edge function `check-payment-reminders`

- Na logica de cadencia de vencidos, ao inves de checar apenas dias fixos (1,2,10,11,20,30), buscar todos os templates do usuario e extrair os dias de cada `tipo_lembrete` com pattern `vencido_d(\d+)`
- Para cada parcela vencida, verificar se `diasAtraso` bate com algum dos dias configurados

