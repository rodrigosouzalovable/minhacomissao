# Subdomínio luizcarlos.meusacordos.com.br

Sim, é possível. Subdomínio é conectado no painel do projeto e serve o mesmo site; a diferença de rodapé é feita no código, detectando o endereço acessado.

## O que você faz (uma vez)

1. Configurações do Projeto > Domínios > Connect Domain
2. Digite o subdomínio completo: `luizcarlos.meusacordos.com.br`
3. No seu provedor de DNS, crie o registro indicado (A `luizcarlos` → 185.158.133.1, mais o TXT de verificação)
4. Mantenha `meusacordos.com.br` como domínio primário

Observação importante: um site precisa ser público para a Meta conseguir acessá-lo — não existe forma de liberar só para a Meta. O que faremos é deixá-lo público mas "não divulgado": nenhum link para ele no site principal e bloqueio de indexação em buscadores (noindex + robots), então na prática só quem tem o endereço entra.

## O que eu implemento

1. Perfil de contato por domínio: uma tabela de perfis com telefone e e-mail. Perfil `luizcarlos` → e-mail `luizcarlos@souzaeribeiro.com.br`, telefone `(62) 98147-4256` (WhatsApp `5562981474256`).
2. Detecção automática do subdomínio no carregamento da página: se o acesso vier de `luizcarlos.meusacordos.com.br`, o portal usa esse perfil; qualquer outro endereço continua exatamente como hoje (`(62) 98218-3144`).
3. Rodapé com bloco de contato ampliado: e-mail exibido junto ao telefone na "Central de Atendimento". Nos domínios atuais, exibe-se o e-mail institucional já usado hoje, sem outra mudança visual.
4. Aplicado nas mesmas páginas: portal principal, Política de Privacidade e Antifraude — para a Meta encontrar contato consistente em todas.
5. Meta tag `noindex, nofollow` quando o acesso for pelo subdomínio, para não aparecer em buscas.

Página, layout, logos e funcionalidades permanecem idênticos ao site principal.

## Detalhes técnicos

- Novo `src/lib/contatoPorDominio.ts`: mapa `hostname → { phone, phoneDisplay, email }` com fallback ao `credorConfig` atual.
- `PortalConsulta.tsx`, `PoliticaPrivacidade.tsx`, `Antifraude.tsx`: substituir constantes fixas de telefone/e-mail pelo resultado do mapa (header, rodapé e botão flutuante do WhatsApp).
- Injeção do `<meta name="robots" content="noindex, nofollow">` via efeito no root quando o host for de subdomínio pessoal.
- Nenhuma mudança de banco, rota ou lógica de negócio.
