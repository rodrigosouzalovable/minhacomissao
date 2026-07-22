## O que está acontecendo

O botão atual chama a função `envio-meta-massa-retry-erros`, mas ela nunca foi registrada no `config.toml` do backend — por isso aparece **"Failed to send a request to the Edge Function"**. Além disso, você quer mudar o comportamento e o rótulo do botão.

## Mudanças

**1. Renomear o botão**
- `Reenviar erros (240)` → **`Tentar novamente (240)`**
- Mantém o ícone de repetir, cor âmbar.

**2. Registrar a função no backend**
- Adicionar `envio-meta-massa-retry-erros` ao `supabase/config.toml` para que fique deployada e acessível (isso corrige o "Failed to send a request").

**3. Novo fluxo ao clicar em "Tentar novamente"**
- Os números com erro voltam para a fila como `pendente` (tentativas zeradas, erro limpo).
- O contador de **Erros** cai para 0 imediatamente e esses números entram novamente na contagem de **Pendentes/Processando**.
- A lista **"Erros (240)"** desaparece da tela na hora (some do painel).
- O card mostra rapidamente **"240 números devolvidos para a fila"** e o job volta ao status **Rodando**.
- O disparo respeita a nova regra de **msgs/segundo por instância** e o auto-pause do Rate Limit da Meta (já implementados).
- Atualização automática do progresso e da lista logo em seguida.

**4. Robustez**
- Se a função devolver erro, mostrar mensagem clara ("Não foi possível devolver à fila — tente novamente em instantes").
- Impedir cliques duplos enquanto processa.

## Detalhes técnicos

- `src/components/meta/CampanhaDetalheDialog.tsx`: renomear o botão, ajustar texto de confirmação, forçar refresh imediato (`refreshStatus` + `recarregarItensJob`) para limpar a lista de erros.
- `supabase/config.toml`: adicionar entrada `[functions.envio-meta-massa-retry-erros] verify_jwt = true`.
- A função em si já faz o reset correto (status `pendente`, tentativas 0, decrementa `erros`, reabre o job e re-dispara worker de rajada/tick). Não precisa mexer na lógica.
