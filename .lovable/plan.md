# Plano: Configurar Proxy por instância no editor de Acionamento

## Objetivo
Adicionar uma seção **"Proxy SOCKS5 / HTTP"** dentro do formulário "Editar instância" em **Acionamento → Configuração WhatsApp**, permitindo configurar e aplicar o proxy diretamente naquele card, sem precisar ir até a aba Proxies do Aquecimento.

## O que será feito

### 1) Novo componente `src/components/acionamento/ProxyInstanceSection.tsx`
Recebe `instanceId` como prop. Carrega do banco as colunas já existentes (`proxy_enabled`, `proxy_type`, `proxy_host`, `proxy_port`, `proxy_username`, `proxy_password`, `proxy_aplicado_em`, `proxy_ultimo_erro`).

Renderiza um bloco compacto com:
- Switch ativar/desativar
- Campos: Tipo (SOCKS5/HTTP) · Host · Porta · Usuário · Senha (com olho mostrar/ocultar)
- Badge de status (Desativado / Pendente / Aplicado / Erro)
- Mensagem do último erro (se houver)
- Dois botões: **Salvar** (só persiste no banco) e **Salvar e aplicar na UAZAPI** (chama edge function `uazapi-set-proxy` já existente)

### 2) Integração em `src/pages/Acionamento.tsx`
Inserir `<ProxyInstanceSection instanceId={editingInstance.id} />` dentro do formulário de edição, **logo abaixo do bloco "Perfil WhatsApp"** (após o `</div>` da linha 3053) e antes dos botões "Salvar/Cancelar" da linha 3055.

A seção só aparece quando `editingInstance.id` existe (instância já salva), pois precisa do ID para aplicar.

### 3) Reaproveitamento total
- Edge function `uazapi-set-proxy`: já existe, sem mudanças.
- Schema: já existe, sem migration nova.
- Aba "Proxies" no Aquecimento continua existindo para visão em massa.

## Arquivos
```text
NOVO  src/components/acionamento/ProxyInstanceSection.tsx
EDIT  src/pages/Acionamento.tsx  (1 import + 1 linha JSX no editor)
```

## Custo Cloud
Zero adicional. A edge function só é invocada quando o usuário clica em "Aplicar".

Aprovar para eu implementar?
