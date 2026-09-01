# Verificação de domínio Meta por subdomínio

## Situação do subdomínio luizcarlos

Verifiquei agora: o registro A (185.158.133.1) e o TXT `_lovable.luizcarlos` já estão publicamente visíveis e corretos. O status na Lovable está como "initiated" (setup iniciado, não concluído) há ~33 min. Falta apenas você abrir Configurações do Projeto → Domínios e clicar em concluir/verificar (Check status) — os registros já passam.

## O que vou construir

Na aba Domínios, cada subdomínio ganha um campo próprio para a meta tag de verificação da Meta:

1. Campo "Verificação de domínio Meta" no formulário de criação/edição — você cola a tag inteira (`<meta name="facebook-domain-verification" content="..." />`) ou só o código; o sistema extrai o código automaticamente.
2. Ao salvar, o portal público servido naquele hostname passa a inserir a meta tag correspondente no `<head>`.
3. No painel de instruções do subdomínio: exibição da tag salva com botão de copiar, link direto para o Business Manager (Configurações do negócio → Segurança da marca → Domínios) e botão "Abrir verificação na Meta".

## Aviso importante e honesto

Este app é uma SPA estática: a meta tag inserida por JavaScript **não** aparece no HTML bruto que o robô da Meta lê. Ou seja, o método "meta tag" tende a falhar aqui para subdomínios. Duas saídas confiáveis:

- **Recomendado: verificação por registro DNS TXT** na Meta. Ela oferece essa opção; você cria um TXT no registro.br para o subdomínio e a verificação passa sem depender de HTML. Vou incluir esse fluxo na aba Domínios (campo para o TXT da Meta + nome pronto para o registro.br + botão de copiar), do mesmo jeito que já existe para o TXT da Lovable.
- Alternativa: manter uma meta tag realmente estática. Só é possível para um único código no `index.html` (é o caso do domínio principal hoje). Para vários subdomínios com códigos diferentes, seria necessário SSR — [o que a migração para TanStack Start traz](https://lovable.dev/blog/building-apps-using-tanstack-start).

Portanto o plano entrega os dois campos (meta tag e TXT da Meta), com destaque de que o TXT é o caminho que funciona.

## Detalhes técnicos

- Migração: `ALTER TABLE public.portal_dominios ADD COLUMN meta_verification text, ADD COLUMN meta_txt_verify text`.
- `src/pages/AdminDominios.tsx`: campos no formulário, sanitização do valor colado (regex extraindo `content="..."`), novos `CopyField` (tag completa, nome do TXT `<prefixo>` e valor), passo a passo atualizado com as duas opções.
- `src/hooks/useContatoPortal.ts` / portal público: injeção da meta tag no `<head>` quando houver valor para o hostname atual (efeito colateral apenas de `document.head`, sem alterar layout).
- Sem mudanças na lógica de contato por domínio nem no restante do portal.
