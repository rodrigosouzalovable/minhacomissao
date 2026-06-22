## Painel de detalhamento de envios

Adicionar, abaixo do card "4. Delay e disparo", um novo painel mostrando, em tempo real, **quais números** caíram em cada categoria — em vez de só os contadores agregados que existem hoje.

### Categorias exibidas

1. ✅ **Enviados** — telefone + instância usada + horário
2. ❌ **Erros no envio Meta** — telefone + instância + mensagem de erro (ex.: template rejeitado, número bloqueado, tier estourado)
3. 🚫 **Sem WhatsApp / falha na validação** — telefones descartados pelo `check-whatsapp-numbers` (separando "sem WA" de "erro de validação")

### Comportamento

- Painel aparece assim que o usuário clica em **Disparar** e persiste após o término (até iniciar novo disparo ou recarregar a página).
- Atualiza em tempo real durante o loop (mesmo cadência do progresso atual).
- Cada categoria é uma seção colapsável (`<details>`) com contador no título; lista rolável (`max-h-48 overflow-auto`) com fonte mono pequena.
- Botão **Copiar** em cada categoria (copia números separados por quebra de linha) e botão **Exportar CSV** geral (telefone, status, instância, erro).

### Mudanças técnicas

`src/pages/EnvioMeta.tsx`:

- Novo estado `detalhes`:
  ```ts
  type EnvioItem = { telefone: string; instancia?: string; erro?: string; ts: number };
  const [detalhes, setDetalhes] = useState<{
    enviados: EnvioItem[];
    erros: EnvioItem[];
    semWhatsapp: string[];
    erroValidacao: string[];
  }>({ enviados: [], erros: [], semWhatsapp: [], erroValidacao: [] });
  ```
- Na validação UAZAPI: popular `semWhatsapp` com `vData.invalid` e `erroValidacao` com `vData.errors` (o edge `check-whatsapp-numbers` já retorna esses arrays).
- No loop de envio: a cada iteração, fazer `push` em `enviados` ou `erros` com `{ telefone, instancia: instInfo?.nome, erro: msg, ts: Date.now() }`.
- Resetar `detalhes` no início de `enviar()`.
- Novo componente inline `<DetalhesEnvioCard>` renderizado abaixo do card de delay/disparo, visível quando `detalhes` tem qualquer item ou `enviando` é true.

### Fora de escopo

- Não muda o backend (`send-whatsapp-meta` e `check-whatsapp-numbers` já devolvem o necessário).
- Não persiste no banco — estado vive na página (já existe `meta_whatsapp_envios_log` para histórico).
- Não investiga por que algumas mensagens "enviadas" não chegam no WhatsApp do destinatário — isso normalmente é entrega Meta (status `sent` ≠ `delivered`); se quiser, posso depois adicionar coluna de status de entrega via webhook Meta.