## Objetivo

1. Na aba **API Oficial Meta** (`/admin/configurar-meta`), permitir marcar quais templates HSM ficam disponíveis na aba **Envio Meta Massa**.
2. Na aba **Envio Meta Massa** (`/admin/envio-meta`), mostrar apenas os templates marcados **e** indicar quais estão presentes/aprovados em TODAS as instâncias selecionadas — evitando erros de envio.

## Mudanças no banco

Adicionar coluna simples na tabela `meta_whatsapp_templates`:

- `habilitado_envio_massa boolean not null default false` — marca se o template aparece na aba de envio em massa.

Como a Meta sincroniza um registro por (instância, nome_template, idioma), a identidade "mesmo template" é feita pela chave `(nome_template, idioma)`. Vamos agrupar por essa chave nas duas telas.

## API Oficial Meta — seleção de templates

Na seção "Templates HSM" da página `ConfigurarMeta.tsx`:

- Agrupar os registros por `nome_template + idioma` (dedup entre instâncias).
- Cada linha do template mostra:
  - Nome / categoria / idioma.
  - Checkbox **"Disponível em Envio em Massa"** — grava `habilitado_envio_massa` em todos os registros do grupo (uma linha por instância).
  - Coluna **Cobertura**: badge `X de Y instâncias` (quantas instâncias têm esse template com status `approved`). Verde se X=Y, âmbar se parcial, vermelho se zero.
  - Tooltip listando quais instâncias têm/não têm o template aprovado — o usuário vê exatamente onde falta sincronizar ou aprovar.
- Botão "Sincronizar templates" já existe por instância; adicionar botão **"Sincronizar todas"** que roda `meta-sync-templates` para cada instância ativa em sequência.

## Envio Meta Massa — filtragem + compatibilidade

Em `EnvioMeta.tsx`:

- Query passa a filtrar `.eq("habilitado_envio_massa", true).eq("status","approved")`.
- Dedup por `(nome_template, idioma)` no dropdown — usuário vê cada template uma vez.
- Ao selecionar um template E instâncias, calcular compatibilidade:
  - Set de instâncias que têm esse `(nome, idioma)` com `status='approved'`.
  - Se alguma instância selecionada NÃO estiver no set → mostrar alerta amarelo listando as instâncias incompatíveis, com botões:
    - "Remover instâncias incompatíveis da seleção".
    - "Sincronizar templates dessas instâncias" (chama `meta-sync-templates`).
  - Botão **Iniciar envio** desabilita enquanto houver incompatíveis.
- No dropdown, cada template também mostra badge de cobertura (`3/3`, `2/3`) para escolha consciente antes da seleção de instâncias.

## Fluxo do usuário

```text
Configurar Meta
  └── Templates HSM
        ├── [x] boas_vindas_pt   Cobertura 3/3  ✅
        ├── [ ] promo_black      Cobertura 2/3  ⚠  (falta em: IPHONE B8)
        └── [x] cobranca_util    Cobertura 3/3  ✅

Envio Meta Massa
  └── Template: [ boas_vindas_pt ▾ ]   (só aparecem os marcados)
        Instâncias: [x] A  [x] B  [x] C
        ✅ Todas as instâncias têm este template aprovado.
```

## Arquivos a editar

- `supabase/migrations/*` — adiciona coluna `habilitado_envio_massa`.
- `src/pages/ConfigurarMeta.tsx` — nova UI de curadoria + cobertura + "Sincronizar todas".
- `src/pages/EnvioMeta.tsx` — filtro por `habilitado_envio_massa`, dedup, checagem de compatibilidade, alerta bloqueante.

## Fora do escopo

- Não altera `meta-sync-templates` nem `send-whatsapp-meta`.
- Não mexe em envio/agendamento/round-robin já existentes.
- Sem novos custos de Cloud (apenas 1 coluna boolean e consultas já existentes).
