

# IA pergunta ao usuário quando não consegue executar

## Problema
Quando a automação falha ou encontra algo inesperado, a IA apenas reporta o erro. O usuário quer que ela **pergunte como fazer** para aprender e tentar de novo.

## Solução
Ajustar o prompt do sistema e o resultado da tool para instruir a IA a fazer perguntas específicas quando a automação falha, em vez de apenas reportar o erro.

## Mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/functions/chat-cobmais-knowledge/index.ts` | Atualizar system prompt + enriquecer mensagem de erro da tool |

### Detalhes

1. **System prompt** — adicionar regras:
   - Quando a automação falhar ou retornar erro, **pergunte ao usuário** como proceder (ex: "Não consegui encontrar o botão X. Pode me explicar onde ele fica ou como devo fazer?")
   - Sugira enviar um vídeo de treinamento se o fluxo não estiver nos conhecimentos
   - Ofereça tentar novamente com as instruções do usuário

2. **Mensagem de erro da tool** — quando `automationResult.success === false`, incluir no `toolResultContent` uma instrução como:
   ```
   "A automação falhou: [erro]. IMPORTANTE: Pergunte ao usuário como ele faria para resolver isso. 
   Seja específico sobre o que deu errado e peça orientação clara. 
   Se possível, sugira que ele envie um vídeo mostrando o passo que faltou."
   ```

3. **Incluir detalhes do histórico** — se o resultado da automação tiver `history` (passos executados), incluir na mensagem para a IA saber exatamente onde parou e perguntar sobre o passo específico que falhou.

