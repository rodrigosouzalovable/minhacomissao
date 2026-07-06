## Diagnóstico

Vi na gravação da tela que você clicou no botão azul **"Disparar (1)"** (envio em massa) e recebeu o toast **"Nenhuma instância disponível (cota, pausa ou qualidade)"**.

Esse é exatamente o bloqueio que expliquei no plano anterior: o **"Disparar"** passa pela função `pick-meta-instance`, que respeita todas as travas de ramp-up. Como todas as 16 instâncias ainda estão em `estado_pool = 'aguardando_templates'`, ela recusa qualquer envio em massa.

O botão **verde "Enviar teste (1º número)"** que adicionei na rodada anterior **não passa** pelo `pick-meta-instance` e ignora essas travas — é justamente ele que você precisa usar para testar com o seu número. Mas percebo que a interface não deixa isso claro: os dois botões estão lado a lado com destaque parecido, e o "Disparar" é o primeiro/maior, então é natural clicar nele.

## Plano

### 1. Fazer o "Disparar" cair automaticamente em modo teste quando não há instância ativa no pool
No `EnvioMetaSendingContext`, quando `pick-meta-instance` retornar sucesso:false para **todas** as instâncias selecionadas e a lista de destinatários tiver **1 número apenas**, tentar reenviar aquele único envio com `modo_teste: true` diretamente pela `send-whatsapp-meta`, usando a primeira instância marcada.

Motivação: se o usuário está disparando para 1 número só, é claramente um teste. Assim ele nunca precisa saber que existe um botão separado.

Para 2+ destinatários, manter o bloqueio e mostrar o toast melhorado: "Nenhuma instância ativa no pool. Use 'Enviar teste' ou ative as instâncias em Configurar Meta → Pool."

### 2. Destacar visualmente o botão "Enviar teste"
- Trocar o `variant="secondary"` para uma cor de destaque (borda + fundo âmbar) e mover para a **esquerda do "Disparar"** quando `recipients.length === 1`, com um pequeno rótulo "Recomendado para teste" abaixo.
- Quando `recipients.length > 1`, ele volta para depois do "Disparar" (secundário).

### 3. Mostrar aviso ativo no card 2 (Instâncias)
Quando **todas** as instâncias marcadas estão em `estado_pool !== 'ativo'`, exibir uma faixa amarela discreta:
> "Nenhuma instância marcada está ativa no pool ainda. Só é possível enviar via 'Enviar teste' — o disparo em massa está bloqueado."

Assim você entende antes de tentar clicar em "Disparar".

## Fora do escopo
- Não vou ativar as instâncias no pool automaticamente (mantém a proteção anti-ban/gasto Meta).
- Nenhuma mudança na `send-whatsapp-meta`, que já suporta `modo_teste: true`.

## Arquivos afetados
- `src/contexts/EnvioMetaSendingContext.tsx` — fallback para modo teste quando 1 destinatário e todas as instâncias bloqueadas.
- `src/pages/EnvioMeta.tsx` — destaque do botão "Enviar teste" e aviso no card 2.
