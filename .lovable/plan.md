

# Reordenar seções da página Robô CobMais

## Ordem atual no código

1. Status cards (4 cards no topo)
2. Configuração + Console de Comandos
3. Streaming do Robô
4. **Código do Robô (server.js)**
5. **Conhecimento Aprendido**
6. **Chat com a IA**
7. Fila & Logs

## Ordem desejada (conforme as imagens)

1. Status cards ✅ (já está)
2. Configuração + Console ✅ (já está)
3. Streaming ✅ (já está)
4. **Chat com a IA** ← mover para cima
5. **Conhecimento Aprendido** ← mover para cima
6. **Código do Robô** ← mover para baixo
7. Fila & Logs ✅ (já está)

## Mudança

Arquivo: `src/pages/AutomacaoCobMais.tsx`

Reordenar os 3 blocos JSX (linhas ~855-1119) trocando a ordem de:
- Código do Robô (linha 858-859) → vai para depois do Conhecimento
- Conhecimento Aprendido (linhas 861-953) → vai para depois do Chat
- Chat com a IA (linhas 955-1119) → vai para logo após o Streaming

Nova sequência no JSX:
1. Streaming (sem mudança)
2. Chat com a IA (bloco linhas 955-1119)
3. Conhecimento Aprendido (bloco linhas 861-953)
4. Código do Robô (linha 858-859)
5. Fila & Logs (sem mudança)

