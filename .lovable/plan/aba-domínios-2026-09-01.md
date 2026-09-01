# Aba Domínios

Nova aba administrativa para cadastrar subdomínios do Meus Acordos. Hoje os perfis de contato por domínio estão fixos no código (`src/lib/contatoPorDominio.ts`, com `luizcarlos.meusacordos.com.br`); a aba passa a guardá-los no banco, então criar um novo subdomínio deixa de exigir alteração de código.

## O que a aba faz

1. Lista os subdomínios cadastrados com host, responsável, telefone, e-mail e status (ativo / não indexado).
2. Botão "Novo subdomínio": você informa apenas o prefixo (ex.: `luizcarlos`) e os dados de contato (nome do responsável, telefone WhatsApp, e-mail). O sistema monta o host completo `prefixo.meusacordos.com.br`.
3. Depois de salvar, a aba mostra um painel "Como registrar" com os dados prontos para copiar:
   - Registro A: nome `prefixo`, valor `185.158.133.1`
   - Registro TXT de verificação (`_lovable`) — o valor exato é exibido pela Lovable ao conectar o domínio; a aba explica onde pegá-lo
   - Botão de copiar em cada campo e um resumo para colar no registro.br
   - Passo a passo: registro.br (criar os registros) e Configurações do Projeto > Domínios > Connect Domain (digitar o host completo)
4. Edição e desativação de cada subdomínio, com aviso de que o domínio também precisa ser removido no painel da Lovable.
5. Um switch por subdomínio para "não aparecer em buscas" (noindex), hoje aplicado de forma fixa.

O portal público, a Política de Privacidade e a página Antifraude continuam exibindo telefone e e-mail conforme o domínio acessado — a diferença é que passam a ler do banco.

## Detalhes técnicos

- Nova tabela `portal_dominios`: `id`, `hostname` (único, minúsculo), `responsavel_nome`, `telefone` (formato internacional), `telefone_display`, `email`, `noindex` (bool), `ativo` (bool), `criado_por`, `created_at`. GRANTs: `SELECT` para `anon` e `authenticated` (o portal é público), escrita apenas para admin via `has_role`; `ALL` para `service_role`.
- `src/lib/contatoPorDominio.ts` mantém o mapa atual como fallback imediato (evita "piscar" o contato errado no primeiro render) e ganha função para mesclar registros vindos do banco.
- `useContatoPortal` passa a buscar a linha do host atual via React Query (`staleTime` alto, uma query leve por hostname) e cai no fallback estático enquanto carrega ou se não houver registro. Sem novos polling/realtime — custo praticamente nulo.
- Nova página `src/pages/AdminDominios.tsx` + rota `/admin/dominios` protegida por `AdminRoute`, e item de menu "Domínios" em `AppLayout.tsx` (`adminOnly`).
- Migração de dados: inserir o registro existente do `luizcarlos` para nada mudar no ar.
- Nenhuma alteração de layout do portal, rotas públicas ou regras de negócio.

## Limite honesto

A criação do registro DNS no registro.br e a conexão em Configurações do Projeto > Domínios continuam manuais — a Lovable não expõe API para isso. A aba centraliza e formata todas as informações necessárias para esses dois passos.
