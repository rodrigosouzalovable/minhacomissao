

## Plano: Edição de perfil WhatsApp nas configurações de instância

### Resumo
Adicionar ao formulário de edição de instância (em Acionamento > Configurações) uma seção "Perfil WhatsApp" que permite alterar foto, nome do perfil, descrição comercial, endereço e email via endpoints UAZAPI.

### Endpoints UAZAPI utilizados
- `POST /profile/name` — altera o nome do perfil
- `POST /profile/image` — altera a foto (aceita URL ou base64)
- `POST /business/update/profile` — altera description, address, email

### Alterações

**1. `src/pages/Acionamento.tsx`**

- Adicionar nova seção "Perfil WhatsApp" no formulário de edição de instância existente (abaixo dos campos Server URL / Instance Token), visível **apenas para instâncias existentes e conectadas**.
- Campos:
  - **Foto do perfil**: Input de URL da imagem + botão "Aplicar" + botão "Remover foto"
  - **Nome do perfil**: Input de texto + botão "Salvar"
  - **Descrição comercial**: Textarea + botão "Salvar"
  - **Endereço comercial**: Input de texto
  - **Email comercial**: Input de texto
  - Botão único "Salvar dados comerciais" para description + address + email (todos no mesmo endpoint)

- Cada ação chama a API UAZAPI diretamente do frontend:
  - Nome: `POST {server_url}/profile/name` com header `token: {instance_token}` e body `{ "name": "..." }`
  - Foto: `POST {server_url}/profile/image` com header `token: {instance_token}` e body `{ "url": "..." }` ou `{ "remove": true }`
  - Dados comerciais: `POST {server_url}/business/update/profile` com header `token: {instance_token}` e body `{ "description": "...", "address": "...", "email": "..." }`

- Adicionar estados para os campos do perfil e loading individual por ação.
- Ao abrir a edição de uma instância conectada, buscar dados atuais do perfil via `POST {server_url}/business/get/profile` para pré-preencher os campos.

### Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Acionamento.tsx` | Adicionar seção de perfil WhatsApp no formulário de edição |

Nenhuma alteração de banco de dados necessária — tudo é via API UAZAPI.

