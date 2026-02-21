

## Portal Multi-Credor: Grupo Altum + Novo Mundo

### Abordagem

Criar um sistema de configuracao por credor onde cada rota (`/grupoaltum`, `/novomundo`) carrega automaticamente a identidade visual, telefone, logos e textos corretos. As paginas de portal e resultado de consulta serao reutilizadas -- apenas os dados de branding mudam.

### Estrutura de rotas

```text
/                        -> Pagina seletora (escolha entre Grupo Altum ou Novo Mundo)
/grupoaltum              -> Portal de consulta com branding Grupo Altum
/novomundo               -> Portal de consulta com branding Novo Mundo
/consulta/grupoaltum/:cpf -> Resultado da consulta (branding Grupo Altum)
/consulta/novomundo/:cpf  -> Resultado da consulta (branding Novo Mundo)
```

### Arquivos e alteracoes

**1. Novo arquivo: `src/lib/credorConfig.ts`**

Centraliza toda a configuracao de cada credor:

```text
- slug (grupoaltum, novomundo)
- nome da empresa
- telefone (PHONE e PHONE_DISPLAY)
- logos (principal, negociacao, parceiro)
- texto "Quem somos"
- texto do footer
- cores principais (se necessario diferenciar)
```

**2. Novo arquivo: `src/pages/PortalHome.tsx`**

Pagina raiz (`/`) que exibe os dois portais como opcoes:
- Card "Grupo Altum" com logo -> redireciona para `/grupoaltum`
- Card "Novo Mundo" com logo -> redireciona para `/novomundo`
- Mantendo a identidade visual da Souza e Ribeiro como escritorio central

**3. Alteracao: `src/pages/PortalConsulta.tsx`**

- Receber o parametro `:creditor` da rota
- Buscar a configuracao do credor em `credorConfig.ts`
- Substituir todas as constantes hardcoded (PHONE, logos, textos) pelos valores da config
- O formulario de consulta redireciona para `/consulta/:creditor/:cpf`

**4. Alteracao: `src/pages/ConsultaResultado.tsx`**

- Receber o parametro `:creditor` da rota
- Aplicar logos, telefone e textos do credor correto
- Links de WhatsApp usam o telefone do credor
- Link "Voltar" aponta para `/:creditor` em vez de `/`

**5. Alteracao: `src/App.tsx`**

Atualizar as rotas:
```text
/                          -> PortalHome (pagina seletora)
/:creditor                 -> PortalConsulta (com validacao do slug)
/consulta/:creditor/:cpf   -> ConsultaResultado
```

**6. Logo do Novo Mundo**

Sera necessario fornecer o logo do Novo Mundo para adicionar em `src/assets/`. Enquanto isso, posso usar um placeholder ou o texto "NOVO MUNDO" estilizado.

### Detalhes tecnicos

- A configuracao do credor e um objeto tipado com interface `CredorConfig`
- Se o slug na URL for invalido, redireciona para `/`
- A consulta RPC `consultar_debitos_por_cpf` ja funciona independente do credor (busca por CPF)
- Futuramente, pode-se filtrar debitos por credor se necessario (campo `credor` ja existe na tabela `devedores`)
- As paginas de Politica de Privacidade e Antifraude podem receber um parametro opcional de credor ou permanecer genericas da Souza e Ribeiro

### Sobre filtrar debitos por credor

A tabela `devedores` ja tem o campo `credor`. Ao acessar `/novomundo`, a consulta pode filtrar apenas os debitos do credor "NOVO MUNDO" (ou equivalente). Isso evita que um cliente veja debitos de outro credor no portal errado. Isso sera implementado como um filtro adicional na consulta.

