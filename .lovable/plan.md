

# Melhorias no Dialog de Configurações WhatsApp

## Análise

O dialog atual já salva instâncias e as exibe em lista, mas os botões de ação (Editar, Testar, Remover) ficam empilhados abaixo de cada instância. O usuário quer um layout mais limpo com botões de editar e apagar alinhados à direita de cada item.

## Verificação da Rotação Round-Robin

O código em `useAutoSend.tsx` implementa corretamente a rotação:
```typescript
const currentConfig = uazapiConfigs[roundRobinCounterRef.current % uazapiConfigs.length];
roundRobinCounterRef.current++;
```
A lógica está correta. O `handleAutoSend` em `Acionamento.tsx` também monta o array de configs corretamente a partir das instâncias ativas. A rotação funciona.

## Alteração: UI da lista de instâncias no dialog

**Arquivo:** `src/pages/Acionamento.tsx` (linhas 1019-1063)

Reorganizar cada instância salva para ter layout horizontal compacto:
- Esquerda: ícone WhatsApp + nome + badge ativo/inativo + URL truncada
- Direita: Switch de ativar/desativar + botões de ícone (Testar, Editar, Apagar)

O formulário de adicionar/editar permanece como está (abre inline ao clicar em "Adicionar" ou "Editar").

Resultado visual: lista limpa tipo histórico, com ações compactas no lado direito.

