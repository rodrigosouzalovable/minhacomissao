## Mudanças

### 1) `src/pages/EnvioMeta.tsx` — remover duplicados além de quem não tem WhatsApp

- Novo helper `normalizeTelKey(tel)` (só dígitos, prefixa `55` quando 10/11 dígitos) e `dedupRecipientsRaw(raw)` que devolve `{ texto, duplicados, total }`.
- `parseRecipients` passa a deduplicar pelo telefone normalizado (mantém a primeira ocorrência, preserva o nome).
- `importarExcel`: deduplica os números importados antes de gravar no textarea. Toast: `X importados · Y ignorados · Z duplicados removidos`.
- `validarAgora`: antes de chamar `check-whatsapp-numbers`, roda `dedupRecipientsRaw`; se removeu, reescreve `recipientsRaw` e mostra toast informando os duplicados retirados. Continua validando só a lista única.
- `removerSemWhatsApp`: continua existindo; agora também deduplica ao reescrever o textarea.
- `enviar`: idem — deduplica antes de validar/disparar; o `confirm` mostra explicitamente os duplicados descartados.
- Painel "Resultado da validação" ganha uma 4ª linha: **🔁 Duplicados removidos: N** (informativa, vindos do passo de dedup).

Critério de duplicidade: telefone normalizado idêntico, ignorando o nome.

### 2) `src/pages/ModeloMensagem.tsx` — Nome e Telefone como botões "Mensagem 1/2"

Na coluna **Cliente** e **Telefone(s)** da tabela principal:

- Substituir o `<span>` + `<CopyButton>` do nome por um único `<Button size="sm" variant="outline" className="h-8">` com ícone `Copy` e o **nome do cliente como label** (chama `copiarNome(c)`). Mantém o destaque `animate-pulse-slow` quando `isHighlighted(c.cpf,'nome')` e o `line-through` quando contatado.
- Para cada telefone, substituir o par `<span>` + `<Button icon>` por um único `<Button size="sm" variant="outline" className="h-8">` com:
  - ícone de status à esquerda (`CheckCircle2` verde / `XCircle` vermelho / `HelpCircle` âmbar) quando houver `whatsappStatus`,
  - número como label,
  - classes de cor (`text-red-600 line-through`, `text-emerald-700`, `text-amber-600`) aplicadas ao label conforme o status atual,
  - tooltip (`title`) com "Tem WhatsApp / Sem WhatsApp / Erro ao verificar / Clique para copiar",
  - `onClick` mantém `copiarTel(c.cpf, t)` com `e.stopPropagation()`.

Visual ficará alinhado com os botões **Mensagem 1** / **Mensagem 2** (mesmo `variant="outline"`, mesma altura `h-8`, mesmo ícone `Copy`). Demais colunas (`#`, Contatado, Mensagens) ficam inalteradas.

## Fora de escopo
- Não muda edge functions (`check-whatsapp-numbers` etc.).
- Não muda `EnvioMetaSendingContext` nem persistência do `ModeloMensagem`.
