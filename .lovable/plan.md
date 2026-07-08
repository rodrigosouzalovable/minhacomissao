## Ajustes na aba "Envio Meta Massa"

### 1. Aba "Enviados" fecha sozinha durante o disparo

**Causa:** o componente `Section` (em `src/pages/EnvioMeta.tsx`) usa um `<details>` com a prop `open={count > 0 && count <= 20}` sempre controlada. Como a página faz polling durante o envio, a cada atualização o React re-renderiza e reforça o `open` conforme a contagem. Quando `count` passa de 20 (ex.: 44 enviados na tela), a expressão vira `false` e fecha o painel automaticamente, mesmo que o usuário tenha clicado para abrir.

**Correção:** trocar o `open` controlado por um estado inicial não controlado (`defaultOpen` interno), preservando a interação do usuário:
- Adicionar um `useState` dentro de `Section` inicializado com `count > 0 && count <= 20` (ou receber `defaultOpen` por prop).
- Usar `open={aberto}` + `onToggle` do `<details>` para sincronizar apenas quando o usuário clica, ignorando mudanças de `count`.
- Resultado: uma vez aberto pelo usuário, o painel permanece aberto durante o disparo; se ele fechar manualmente, permanece fechado.

### 2. Botão "Selecionar todas" no campo "2. Instâncias"

Em `src/pages/EnvioMeta.tsx`, no `CardHeader` do card "2. Instâncias", adicionar um botão ao lado (ou acima) do "Verificar saúde":

- Texto alterna entre **"Selecionar todas"** e **"Limpar seleção"** conforme o estado atual (`instanciaIds.length === instancias.length`).
- Ao clicar:
  - Se nem todas estão marcadas: `setInstanciaIds(instancias.map(i => i.id))`.
  - Se todas já estão marcadas: `setInstanciaIds([])`.
- Desabilitado quando `instancias.length === 0`.
- Estilo compatível com o botão "Verificar saúde" (variant `outline`, size `sm`).

### Fora de escopo

- Nenhuma mudança em edge functions, backend, lógica de round-robin ou pooling.
- Nenhuma mudança nas outras seções ("Erros", "Sem WhatsApp", "Erro na validação") além do mesmo ajuste de comportamento aberto/fechado que já compartilham o mesmo `Section`.
