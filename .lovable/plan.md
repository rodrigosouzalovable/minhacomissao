

## Persistir Dados do Perfil WhatsApp ao Reabrir

### Problema
A função `loadWhatsAppProfile` (linha 921) reseta todos os campos e busca dados comerciais via `/business/get/profile`, mas **não extrai o nome do perfil** da resposta da API. O nome está disponível no endpoint `/instance/info` (já chamado como fallback na linha 968), mas nunca é extraído de lá.

### Solução

**Arquivo: `src/pages/Acionamento.tsx`**

1. **Extrair nome do perfil de `/business/get/profile`** (linha ~941): adicionar `setProfileName(profile?.name || profile?.pushName || '')` após extrair description/address/email

2. **Extrair nome do perfil de `/instance/info`** (linha ~976): adicionar `setProfileName(prev => prev || info?.pushName || info?.name || info?.profileName || '')` como fallback, apenas se ainda não foi preenchido

Essas duas mudanças garantem que ao abrir a edição de uma instância conectada, o nome do perfil, foto, descrição, endereço e email serão carregados da API UAZAPI e exibidos nos campos.

### Nota
Os dados já são salvos corretamente na UAZAPI (endpoints `/profile/name`, `/profile/image`, `/business/update/profile`). O problema é apenas de **leitura** ao reabrir o painel.

