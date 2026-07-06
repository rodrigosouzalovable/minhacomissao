## Diagnóstico

Encontrei a causa raiz do som nunca tocar em `src/components/MetaAtendenteNotifier.tsx`:

**Bug principal (linha 51):** o filtro do Realtime é
```
filter: 'direcao=eq.recebida'
```
mas no banco a coluna `direcao` de `meta_whatsapp_mensagens` só usa dois valores: **`entrada`** (recebida) e **`saida`** (enviada). Consulta confirmou: 140 `entrada` e 279 `saida` nos últimos 2 dias, zero `recebida`. Ou seja, o handler **nunca é acionado** — o canal Realtime fica em silêncio para sempre.

**Bug secundário (autoplay):** mesmo depois de corrigir, navegadores modernos bloqueiam `new Audio().play()` se o usuário ainda não interagiu com a aba (sem clique/tecla). Vale um fallback silencioso já existe (`catch {}`), mas precisamos "destravar" o áudio no primeiro gesto do usuário.

As etiquetas `Atendente: Anna Flavia`, `Atendente: Fernanda`, `Atendente: Wallace`, `Atendente: Yasmim` existem, então a lógica de matching de nome está OK.

## Plano de correção

Alterações apenas em `src/components/MetaAtendenteNotifier.tsx` (sem mudanças de backend, migração, ou UI visível):

1. **Corrigir o filtro do Realtime**  
   Trocar `filter: 'direcao=eq.recebida'` por `filter: 'direcao=eq.entrada'`.

2. **Destravar o áudio no primeiro gesto do usuário (autoplay unlock)**  
   Ao montar, adicionar um listener único (`pointerdown` + `keydown`) que faz um `audio.play()` mudo (volume 0) e remove os listeners. Isso "libera" o `Audio` para tocar depois via Realtime sem gesto direto.

3. **Tocar um som de teste único por usuário logado (agora, para todo mundo verificar)**  
   Ao montar o componente e ter o `user` disponível, checar `localStorage.getItem('meta-atendente-som-teste-v1')`. Se ausente, disparar 1 vez o `successSound` (volume 0.35) já no próximo gesto do usuário (usando o mesmo listener do passo 2 — o unlock toca o beep e marca a flag). Assim cada funcionário, ao abrir/atualizar a aba após esse deploy e clicar em qualquer coisa, ouve o som de confirmação uma única vez. Sem flag global no banco, sem custo em Lovable Cloud.

4. **Não alterar** o restante do fluxo (matching de etiqueta, debounce 2s, escopo por `contato_id`) — está correto.

## Detalhes técnicos

- Estrutura do listener de unlock:
  ```ts
  const unlock = async () => {
    // toca o teste, se ainda não tocou
    if (!localStorage.getItem('meta-atendente-som-teste-v1')) {
      try {
        const a = new Audio(successSound); a.volume = 0.35; await a.play();
        localStorage.setItem('meta-atendente-som-teste-v1', String(Date.now()));
      } catch {}
    } else {
      // apenas destrava
      try { const a = new Audio(successSound); a.volume = 0; await a.play(); } catch {}
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  ```
- O canal Realtime já está inscrito em INSERT de `meta_whatsapp_mensagens`. Basta trocar o valor do filtro.
- Nenhum toque em `direcao=eq.recebida` no restante do código; grep confirmou uso isolado.

## Arquivo afetado

- `src/components/MetaAtendenteNotifier.tsx` (edição pontual)

## Como validar

1. Após o deploy, cada funcionário abre a aba e clica em qualquer lugar → ouve o `successSound` uma vez (teste).
2. Uma mensagem real chegando de um contato etiquetado com `Atendente: <nome do usuário>` passa a disparar o som automaticamente.
3. Se não tocar: abrir DevTools → Console → confirmar que não há erro `NotAllowedError` (autoplay). Se houver, é sinal de que o usuário ainda não interagiu com a aba.