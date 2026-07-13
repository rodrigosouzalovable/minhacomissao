
-- 1.1
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A **API do WhatsApp Business** é a solução oficial da Meta para empresas que precisam se comunicar com clientes em escala. Diferente do app manual, ela permite integração com sistemas, envio automatizado e o uso de múltiplos números sob uma mesma conta.

## Conceitos-chave
- **Cloud API**: hospedada pela Meta, sem servidor próprio, atualizações automáticas.
- **On-Premise**: hospedada por você, com mais controle mas **descontinuada em 2025**.
- **WABA**: WhatsApp Business Account, o "container" dos seus números.
- **Business Manager (BM)**: onde ficam WABAs, ativos e permissões.

## Como funciona na prática
| Característica | Cloud API | On-Premise |
| --- | --- | --- |
| Hospedagem | Meta hospeda | Você hospeda |
| Custo de infra | Zero | Servidor próprio |
| Atualizações | Automáticas | Manuais |
| Recomendação atual | ✅ Cloud API | ❌ Descontinuada em 2025 |

> 💡 Se você está começando hoje, use **Cloud API**. Não perca tempo com On-Premise.

## Boas práticas
- Ter uma **Business Manager verificada** antes de subir números críticos.
- Usar um **número dedicado** à API (não use o número pessoal do dono).
- Configurar **método de pagamento** antes do primeiro envio para não ter interrupção.
- Registrar o número em uma WABA que você controla — nunca em BM de terceiros.

## Resumo
- API oficial = escala + integração + confiabilidade.
- Cloud API é o caminho padrão em 2026.
- Toda operação séria começa por BM verificada + número dedicado.
$md$ WHERE modulo_id = 1 AND numero = 1;

-- 1.2
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Desde 2024, a Meta cobra **por mensagem template enviada**, não mais por conversa aberta. Entender essa lógica é o que separa uma operação lucrativa de uma que queima verba.

## Conceitos-chave
- **Marketing**: cobrado por template enviado. É o mais caro.
- **Utility**: cobrado por template — **grátis dentro da janela de 24h** iniciada pelo cliente.
- **Authentication**: cobrado por template (OTPs, códigos).
- **Service**: **grátis** dentro da janela de 24h do cliente.

## Como reduzir custo
1. Prefira **Utility** sempre que possível — cobranças, agendamentos, avisos.
2. Aproveite a **janela de 24h**: se o cliente respondeu, mensagens Service são gratuitas.
3. **Consolide notificações**: não mande 3 templates quando 1 resolve.
4. Monitore o **relatório de billing** toda semana para pegar desvios cedo.

> 💡 Um template Utility bem redigido pode substituir 3 de Marketing e derrubar 60% do custo.

> ⚠️ Enviar Marketing para lista fria queima verba **e** derruba a reputação do número.

## Boas práticas
- Classificar cada disparo antes de subir template.
- Definir **teto mensal** por categoria no BM.
- Revisar templates trimestralmente — a Meta reclassifica sem aviso.
- Sempre acompanhar o **quality_rating** ao lado do custo.

## Resumo
- Cobrança é por template, não por conversa.
- Utility + janela de 24h = combinação mais barata.
- Sem monitoramento semanal, o custo escapa.
$md$ WHERE modulo_id = 1 AND numero = 2;

-- 1.3
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A hierarquia da Meta é o que confunde quem começa: **Portfólio → Business Manager → WABA → Número**. Sem entender essa estrutura, você não consegue nem convidar um colega para gerenciar o WhatsApp.

## Conceitos-chave
- **Portfólio de negócios**: agrupa múltiplas BMs (empresas com CNPJs diferentes).
- **Business Manager (BM)**: representa uma empresa. É onde vivem ativos e permissões.
- **WABA**: conta de WhatsApp dentro da BM. Uma BM pode ter várias.
- **Número de telefone**: recurso dentro da WABA. Cada número tem seus próprios limites e reputação.

## Como funciona na prática
```text
Portfólio
 └── Business Manager (empresa)
      └── WABA (conta WhatsApp)
           └── Número 1 (+55 11...)
           └── Número 2 (+55 62...)
```

> 💡 Trate a BM como um cofre: pouca gente com acesso, papéis bem definidos, 2FA obrigatório para admins.

## Boas práticas
- Uma BM por CNPJ — não misture empresas na mesma BM.
- Verificar a BM **antes** de subir número em produção.
- Separar WABAs por finalidade (cobrança, marketing, atendimento).
- Nunca dar acesso admin para agências externas — use "acesso limitado".

## Resumo
- Portfólio > BM > WABA > Número.
- BM verificada destrava limites, produtos e segurança.
- Estrutura organizada hoje = auditoria fácil amanhã.
$md$ WHERE modulo_id = 1 AND numero = 3;

-- 1.4
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Modelos de mensagem (templates) são o único jeito de iniciar conversa **fora da janela de 24h**. A categoria escolhida define o custo, a velocidade de aprovação e o risco de banimento.

## Conceitos-chave
- **Utility**: transacional. Confirmações, cobranças, agendamentos.
- **Marketing**: promocional. Ofertas, campanhas, novidades.
- **Authentication**: OTPs e códigos de verificação.

## Como escolher a categoria certa
| Situação | Categoria correta |
| --- | --- |
| "Seu boleto vence amanhã" | Utility |
| "Aproveite 20% off no Black Friday" | Marketing |
| "Seu código é 328491" | Authentication |
| "Seu pedido foi enviado" | Utility |
| "Volte, sentimos sua falta!" | Marketing |

> ⚠️ Rotular Marketing como Utility para pagar menos é o erro que mais gera **reclassificação automática + queda de qualidade**.

## Boas práticas
- Redigir com objetivo claro no primeiro parágrafo.
- Sempre incluir **nome do remetente** e **motivo do contato**.
- Evitar linguagem promocional em templates Utility.
- Testar em número de sandbox antes de subir em produção.

## Resumo
- Categoria correta = custo justo + boa reputação.
- Utility é o coração da operação de cobrança.
- Marketing exige lista consentida e frequência controlada.
$md$ WHERE modulo_id = 1 AND numero = 4;

-- 1.5
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Cada número novo começa limitado a **250 conversas iniciadas por dia**. A Meta libera mais capacidade conforme a reputação sobe — esse é o sistema de **Tiers**.

## Conceitos-chave
- **Tier 1**: 250 conversas/dia.
- **Tier 2**: 1.000 conversas/dia.
- **Tier 3**: 10.000 conversas/dia.
- **Tier 4**: 100.000 conversas/dia.
- **Tier ilimitado**: sem teto (raro, exige histórico limpo e volume constante).

## Como escalonar
1. Verifique a BM e o número.
2. Comece com envios pequenos e templates Utility.
3. Mantenha o **quality_rating** em GREEN por 7 dias.
4. A Meta promove automaticamente ao próximo tier ao atingir o volume anterior.
5. Repita — cada tier exige o dobro do anterior mantendo qualidade.

> 💡 Não force volume. Chegar a Tier 3 com base sólida é melhor do que chegar a Tier 4 e cair para RED.

> ⚠️ Quality YELLOW + volume alto = risco imediato de rebaixamento e restrição.

## Boas práticas
- Aquecer o número novo por 5–7 dias antes de disparos grandes.
- Não mudar categoria de template quando estiver perto do teto.
- Monitorar bloqueios: se >2% dos contatos bloquearem, revise a lista.
- Ter **número reserva** já aquecido para casos de queda.

## Resumo
- Tiers dobram: 250 → 1k → 10k → 100k.
- Reputação verde por 7 dias + volume alto = promoção automática.
- Pressa mata reputação. Consistência sobe tier.
$md$ WHERE modulo_id = 1 AND numero = 5;

-- 2.1
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
O Business Manager é a fundação. Configurado errado, tudo depois vira dor de cabeça: verificação recusada, número preso, permissões bagunçadas.

## Passo a passo
1. Acesse **business.facebook.com** logado com o Facebook do sócio/dono.
2. Clique em **Criar conta** e informe: nome da empresa (igual ao CNPJ), e-mail corporativo.
3. Preencha **informações do negócio**: razão social, endereço, telefone, site.
4. Adicione um **método de pagamento** (cartão empresarial de preferência).
5. Ative **verificação em duas etapas** para todos os admins.
6. Inicie a **verificação de empresa** (documentos do CNPJ).

> 💡 Use e-mail corporativo com domínio próprio (empresa.com.br) — aumenta muito a chance de aprovação.

## Boas práticas
- Nome da empresa **idêntico** ao do CNPJ, sem abreviações.
- Endereço batendo com o comprovante que você vai anexar.
- 2 admins no mínimo (nunca 1 só — se ele sair, você perde acesso).
- Documento de comprovação (contrato social ou cartão CNPJ) legível e recente.

> ⚠️ Se a Meta recusar a verificação 2 vezes seguidas, espere 30 dias antes de tentar de novo.

## Resumo
- BM correta = base sólida para tudo.
- Documentos consistentes eliminam 80% dos problemas de verificação.
- 2FA + múltiplos admins = segurança operacional.
$md$ WHERE modulo_id = 2 AND numero = 1;

-- 2.2
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A **WABA** é a conta que "abriga" seus números. Ela é criada dentro da BM e precisa ser vinculada a um **provedor** (a própria Meta na Cloud API ou um BSP oficial).

## Passo a passo
1. No BM, vá em **Contas → Contas do WhatsApp → Adicionar**.
2. Escolha **Criar nova conta do WhatsApp Business**.
3. Vincule à sua BM (deve estar verificada).
4. Aceite os **termos de comércio** do WhatsApp.
5. Configure **nome de exibição** — é o que o cliente vê. Não pode ser genérico ("Cobrança", "Vendas").
6. Aguarde a verificação do nome (24–72h).

## Conceitos-chave
- **Nome de exibição**: nome público, precisa refletir a marca real.
- **Categoria**: setor da empresa (financeiro, varejo, saúde etc.).
- **Descrição**: aparece no perfil do WhatsApp Business.

> 💡 Nome de exibição rejeitado é o motivo #1 de atraso. Use o nome fantasia da empresa, não "SAC" ou "Atendimento".

## Boas práticas
- Uma WABA por finalidade grande (ex.: cobrança em uma, marketing em outra).
- Preencher **foto, descrição, site e endereço** antes do primeiro envio.
- Manter a WABA **sempre com pagamento em dia** — atraso derruba envios.

## Resumo
- WABA = conta de WhatsApp dentro da BM.
- Nome de exibição precisa parecer sua marca real.
- Perfil completo aumenta confiança e reduz bloqueios.
$md$ WHERE modulo_id = 2 AND numero = 2;

-- 2.3
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Cada número adicionado à API vira um **phone_number_id** único, com reputação e limites próprios. Escolher e cadastrar bem esse número define o sucesso da operação.

## Passo a passo
1. No WhatsApp Manager, entre na WABA → **Números de telefone → Adicionar**.
2. Informe o **número dedicado** (não pode estar em outro WhatsApp).
3. Se o número já tinha WhatsApp app, **desinstale** primeiro.
4. Escolha método de verificação: **SMS** ou **ligação**.
5. Digite o código recebido.
6. Registre o **PIN de 6 dígitos** (necessário para qualquer migração futura).

> ⚠️ **Guarde o PIN em cofre.** Sem ele, você não migra o número — nem para outra BM, nem em caso de banimento.

## Conceitos-chave
- **Número dedicado**: nunca use um número que já é WhatsApp pessoal do time.
- **Portabilidade**: um número da API só volta a ser app comum após deregistro formal.
- **phone_number_id**: identificador técnico que você usa nos endpoints.

## Boas práticas
- Comprar linhas com **operadora empresarial** (evita bloqueios de operadora).
- Registrar o **DDD da região** do público (aumenta taxa de resposta).
- Sempre ter **1 número reserva** já aquecido.
- Não trocar de operadora sem deregistrar antes da API.

## Resumo
- Número dedicado + PIN guardado = tranquilidade.
- Cada número tem reputação própria.
- Sempre mantenha uma linha reserva pronta.
$md$ WHERE modulo_id = 2 AND numero = 3;

-- 2.4
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Webhook é o canal pelo qual a Meta te avisa sobre **mensagens recebidas, status de entrega e mudanças de qualidade**. Sem webhook, você fica cego.

## Passo a passo
1. Prepare uma **URL HTTPS pública** (não aceita HTTP nem localhost sem túnel).
2. Escolha um **verify_token** (string aleatória forte que só você e a Meta conhecem).
3. No app do BM → **WhatsApp → Configuração → Webhook → Editar**.
4. Cole a URL de callback e o verify_token.
5. Selecione os campos a receber: **messages**, **message_template_status_update**, **phone_number_quality_update**.
6. Assine cada WABA que deve enviar eventos para essa URL.

## Como funciona na prática
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "messages": [{ "from": "5562...", "text": { "body": "olá" } }]
      }
    }]
  }]
}
```

> 💡 Toda requisição do webhook precisa retornar **HTTP 200 em até 20 segundos**. Se demorar, a Meta reenvia — e reenvia — e reenvia.

## Boas práticas
- Responder **200 imediatamente** e processar em fila (worker), não inline.
- Validar a **assinatura HMAC** de cada payload (evita spoofing).
- Guardar o **id da mensagem** para deduplicar reentregas.
- Ter **2 URLs** (produção e sandbox) para não testar em cima do real.

> ⚠️ Webhook lento é o motivo #1 de "mensagens sumindo". A Meta desiste após várias tentativas falhas.

## Resumo
- Webhook = ouvidos da sua operação.
- Responda 200 rápido, processe depois.
- Assine só os eventos que você usa.
$md$ WHERE modulo_id = 2 AND numero = 4;

-- 2.5
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Tokens são o "cartão de acesso" à API. O tipo escolhido decide se sua integração morre em 24h ou se sobrevive anos.

## Conceitos-chave
- **Token Temporário**: 24h. Ótimo para testes, péssimo para produção.
- **Token de Usuário (User Token)**: expira quando a sessão do Facebook expira. Frágil.
- **Token de Sistema (System User Token)**: **permanente**, ligado a um usuário do sistema no BM. É o correto para produção.

## Como gerar um System User Token
1. BM → **Configurações → Usuários → Usuários do sistema → Adicionar**.
2. Crie um usuário do sistema com papel **Admin**.
3. Atribua os ativos: **WABA** e **App do WhatsApp**.
4. Clique em **Gerar novo token** → selecione o app → escopos: `whatsapp_business_messaging`, `whatsapp_business_management`.
5. **Copie e guarde imediatamente** — o token completo não é mostrado de novo.

> ⚠️ Token de sistema no código-fonte, no Git ou em log é banimento na certa. Use variáveis de ambiente ou cofre de segredos.

## Boas práticas
- **Rotacionar** tokens a cada 90 dias.
- Um token por serviço (envio, webhook, admin) — se um vazar, o dano é limitado.
- Auditar acessos no BM mensalmente.
- Revogar imediatamente qualquer token de ex-colaborador.

## Resumo
- Produção = System User Token. Ponto.
- Escopo mínimo necessário, nunca "tudo".
- Rotação e cofre resolvem 95% dos incidentes.
$md$ WHERE modulo_id = 2 AND numero = 5;

-- 2.6
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A segurança da sua operação depende de três camadas: **tokens bem guardados, permissões enxutas e políticas de acesso ao banco** que armazena conversas e telefones.

## Conceitos-chave
- **Princípio do menor privilégio**: cada pessoa/serviço só vê o que precisa.
- **RLS (Row Level Security)**: no banco, cada linha só é vista por quem tem direito.
- **2FA obrigatório**: qualquer admin do BM precisa ter.

## Camadas de proteção
1. **Tokens**: em variáveis de ambiente ou cofre (Vault, Doppler, 1Password).
2. **Permissões BM**: revisar mensalmente, remover ex-colaboradores no mesmo dia.
3. **Banco de dados**: RLS em toda tabela com dados de cliente.
4. **Logs**: nunca logar payload completo com telefone/mensagem em claro.

> 💡 Trate cada telefone de cliente como CPF. É dado sensível pela LGPD.

## Boas práticas
- Rotacionar tokens em 90 dias.
- 2FA em todos os admins.
- Auditoria trimestral de acessos.
- Backup criptografado do banco de conversas.
- Contrato de operador (LGPD) com todo fornecedor que toca os dados.

> ⚠️ Vazamento de conversa é incidente de segurança **e** LGPD. Tenha um plano de resposta antes que aconteça.

## Resumo
- Menor privilégio + rotação + RLS = base segura.
- 2FA e revogação rápida bloqueiam a maioria dos ataques.
- LGPD começa no design, não no incidente.
$md$ WHERE modulo_id = 2 AND numero = 6;

-- 3.1
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Um template bem estruturado é aprovado rápido, comunica com clareza e converte. Um mal estruturado é rejeitado, retrabalhado e queima tempo.

## Estrutura de um template
- **Cabeçalho** (opcional): texto, imagem, vídeo, documento ou localização.
- **Corpo** (obrigatório): mensagem principal, aceita variáveis `{{1}}`, `{{2}}`...
- **Rodapé** (opcional): texto curto de assinatura ou disclaimer.
- **Botões** (opcional): até 10, dos tipos Call-to-Action (URL/telefone) ou Quick Reply.

## Exemplo comentado
```text
Cabeçalho: 📄 Boleto disponível
Corpo:     Olá {{1}}, seu boleto de R$ {{2}} vence em {{3}}.
           Para negociar, use os botões abaixo.
Rodapé:    Souza & Ribeiro Cobrança
Botões:    [Ver boleto] [Falar com atendente]
```

> 💡 Uma variável por dado — não junte "R$ 1.234,56 vence em 10/07" numa variável só. Fica difícil auditar e fácil de errar.

## Boas práticas
- Corpo com **no máximo 1024 caracteres**.
- Cada variável precisa de **exemplo real** no cadastro.
- Botões Quick Reply para respostas curtas ("Sim", "Não", "Quero negociar").
- Rodapé fixo com nome da empresa reforça reconhecimento.

## Resumo
- Cabeçalho + corpo + rodapé + botões = mensagem premium.
- Variáveis granulares facilitam manutenção.
- Botões aumentam a taxa de resposta.
$md$ WHERE modulo_id = 3 AND numero = 1;

-- 3.2
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A categoria não é escolha estética: define **custo, aprovação e reputação**. E a Meta reclassifica sozinha se você errar.

## Como classificar corretamente
| Intenção da mensagem | Categoria |
| --- | --- |
| Confirmação, aviso, cobrança | Utility |
| Promoção, oferta, remarketing | Marketing |
| Código de verificação, OTP | Authentication |

## Exemplos aplicados
- ✅ **Utility**: "Sua fatura de R$ 250 vence em 3 dias."
- ✅ **Marketing**: "Aproveite 30% off nesta semana!"
- ✅ **Authentication**: "Seu código é 483921."
- ❌ Cadastrar "Volte, sentimos sua falta!" como Utility → **reclassificado como Marketing** e você paga o dobro retroativo.

> ⚠️ Reclassificação automática é definitiva. Não adianta abrir chamado — só refazer o template com a categoria certa.

## Boas práticas
- Se a mensagem serve **para vender**, é Marketing.
- Se serve **para informar sobre uma transação existente**, é Utility.
- Authentication é **só** para OTP/2FA, nada além.

## Resumo
- Categoria certa protege custo e reputação.
- Reclassificação da Meta é rápida e definitiva.
- Na dúvida entre Utility e Marketing, é Marketing.
$md$ WHERE modulo_id = 3 AND numero = 2;

-- 3.3
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A Meta aprova templates em minutos quando o pedido é claro e recusa em minutos quando não é. Existe um padrão do que passa.

## O que aumenta a chance de aprovação
1. **Categoria correta** (revisada na aula anterior).
2. **Corpo objetivo** — sem gírias, sem emojis excessivos, sem CAPS LOCK.
3. **Variáveis com exemplos reais** — não use "XYZ" ou "teste".
4. **Nome do template descritivo** — `cobranca_vencimento_d3`, não `t1`.
5. **Idioma correto** — pt_BR para Brasil, não pt_PT.

## Exemplo aprovado rapidamente
```text
Nome:       cobranca_vencimento_d3
Categoria:  Utility
Idioma:     pt_BR
Corpo:      Olá {{1}}, sua fatura de R$ {{2}} vence em {{3}}.
            Acesse o link para negociar ou pagar.
Exemplo:    {{1}}=Daniel  {{2}}=189,90  {{3}}=15/07
```

> 💡 Cadastre **um exemplo real e coerente** em cada variável. É o que o revisor humano vê.

## Boas práticas
- Templates em português brasileiro **sempre** com `pt_BR`.
- Evitar promessas ("garantido", "melhor preço") em Utility.
- Nunca cadastrar link encurtado (`bit.ly`) — a Meta reprova.
- Testar em sandbox antes de subir em produção.

## Resumo
- Clareza + exemplos reais + categoria correta = aprovação rápida.
- Nome descritivo ajuda você no futuro.
- Sandbox primeiro, produção depois.
$md$ WHERE modulo_id = 3 AND numero = 3;

-- 3.4
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Rejeição de template quase sempre cai em 5–6 motivos recorrentes. Conhecendo, você elimina retrabalho.

## Erros mais comuns
| Erro | Como corrigir |
| --- | --- |
| Categoria errada | Reclassificar (Marketing vs Utility) |
| Link encurtado (bit.ly, tinyurl) | Usar URL completa da própria empresa |
| Variável sem exemplo | Preencher `{{1}}` com valor real |
| Texto promocional em Utility | Reescrever removendo apelo comercial |
| Emojis em excesso ou fora de contexto | Máximo 1–2, alinhados ao conteúdo |
| Nome do template genérico ("teste", "t1") | Usar nome descritivo |
| Idioma marcado errado (pt vs pt_BR) | Corrigir para pt_BR |

> ⚠️ Depois de 3 rejeições seguidas na mesma WABA, a fila fica **mais lenta** para os próximos templates.

## Boas práticas
- Ler o **motivo exato** da rejeição antes de tentar de novo.
- Não recadastrar o mesmo template com mudança cosmética — vai reprovar de novo.
- Se rejeitou por "não conformidade", **reescreva** do zero.
- Pedir revisão humana só quando tiver certeza de que está correto.

## Resumo
- 90% das rejeições cabem em 5 causas.
- Ler o motivo real antes de reenviar.
- Reincidência derruba a fila da WABA inteira.
$md$ WHERE modulo_id = 3 AND numero = 4;

-- 3.5
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Editar um template rejeitado com cuidado é mais rápido do que criar outro do zero — mas exige entender o que a Meta quer ver diferente.

## Passo a passo
1. Abra o template no WhatsApp Manager → veja o **motivo da rejeição**.
2. Duplique o template ou clique em **Editar**.
3. Ajuste **exatamente** o que foi apontado — não mude o resto.
4. Renomeie se mudar categoria (nome deve continuar coerente).
5. Reenvie para aprovação.

## Conceitos-chave
- Um template só pode ser editado **enquanto pendente ou aprovado**, não em rascunho antigo.
- Templates **aprovados** podem ser editados mas passam por revisão de novo.
- Duplicar é útil quando você quer manter a versão antiga funcionando.

> 💡 Se o motivo foi "categoria incorreta", **mude a categoria**, não o texto. Muitos ficam reescrevendo o corpo e continuam rejeitando.

## Boas práticas
- Uma alteração por vez — facilita entender o que passou.
- Guardar histórico de rejeição/aprovação num spreadsheet.
- Testar o template editado em número de sandbox antes de disparar em massa.

## Resumo
- Ler o motivo → alterar só o necessário → reenviar.
- Mudar categoria é diferente de reescrever corpo.
- Documente o histórico para aprender com o padrão de rejeição.
$md$ WHERE modulo_id = 3 AND numero = 5;

-- 3.6
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Quando você tem **muitos números** na mesma WABA, templates precisam ser aplicados em lote — senão vira caos operacional.

## Conceitos-chave
- Um template aprovado na WABA vale para **todos os números** daquela WABA.
- Mas cada número tem **quality_rating** independente, então o desempenho varia.
- Templates são **por WABA**, não por número.

## Estratégias
1. **WABA única para operações similares** — reduz cadastro duplicado.
2. **Naming convention**: `[area]_[objetivo]_[versao]` (ex.: `cob_d3_v2`).
3. **Versionamento**: quando ajustar, crie `_v2`, `_v3` mantendo o antigo até validar.
4. **Painel próprio** para ver qual template está performando em cada número.

> 💡 Um template só é útil se o time inteiro sabe qual usar. Publique a lista oficial num lugar acessível.

## Boas práticas
- Auditoria trimestral: templates sem uso viram lixo — apague.
- Uniformizar tom entre templates da mesma marca.
- Rodar A/B com `_a` e `_b` antes de escolher a versão oficial.

## Resumo
- Um template aprovado serve toda a WABA.
- Naming e versionamento evitam bagunça.
- A/B teste antes de padronizar.
$md$ WHERE modulo_id = 3 AND numero = 6;

-- 4.1
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Enviar mensagem via API é uma chamada HTTP. Simples na aparência, mas cada campo importa — errar formato de telefone é o motivo #1 de "não chegou".

## Exemplo cURL
```bash
curl -X POST \
  https://graph.facebook.com/v20.0/PHONE_NUMBER_ID/messages \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5562991234567",
    "type": "template",
    "template": {
      "name": "cobranca_vencimento_d3",
      "language": { "code": "pt_BR" },
      "components": [
        { "type": "body", "parameters": [
          { "type": "text", "text": "Daniel" },
          { "type": "text", "text": "189,90" },
          { "type": "text", "text": "15/07" }
        ]}
      ]
    }
  }'
```

## Conceitos-chave
- **PHONE_NUMBER_ID**: identificador do número remetente, não o número em si.
- **to**: número do destinatário no formato E.164 **sem sinais** (`5562991234567`).
- **components**: preenche as variáveis `{{1}}`, `{{2}}` do template.

> 💡 Telefone sempre com **DDI + DDD + número**, sem `+`, sem espaço, sem parênteses. Erro nesse campo = mensagem rejeitada silenciosamente.

## Boas práticas
- Postman/Insomnia para desenvolver, código só depois do fluxo estar redondo.
- Salvar `message_id` do retorno — é a única forma de rastrear entrega depois.
- Usar retry com backoff exponencial em erros 5xx.
- Nunca disparar em loop cego — sempre com fila e limite por minuto.

## Resumo
- Formato E.164 sem símbolos.
- Guardar `message_id` de cada envio.
- Fila + retry = envio resiliente.
$md$ WHERE modulo_id = 4 AND numero = 1;

-- 4.2
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Rastrear entrega é responder três perguntas: **chegou?**, **foi lido?**, **respondeu?**. Sem webhook configurado, você não responde nenhuma.

## Status possíveis
| Status | Significado |
| --- | --- |
| `sent` | Mensagem saiu do seu servidor para a Meta |
| `delivered` | Chegou no aparelho do destinatário |
| `read` | Cliente abriu a conversa e viu |
| `failed` | Falha (número inválido, bloqueio, template inválido) |

## Exemplo de payload
```json
{
  "field": "messages",
  "value": {
    "statuses": [{
      "id": "wamid.HBgN...",
      "status": "delivered",
      "timestamp": "1720900000",
      "recipient_id": "5562991234567"
    }]
  }
}
```

> 💡 O `id` (wamid) é o mesmo que você recebeu ao enviar. É a chave para casar envio + status.

## Boas práticas
- Persistir cada mudança de status numa tabela `mensagens_status`.
- Alertar time quando `failed` passar de 3% em 1h.
- Não confiar em `read` para métricas críticas — nem todo cliente tem confirmação de leitura ativa.
- Deduplicar por `wamid` (a Meta pode reenviar o mesmo status).

## Resumo
- 4 status: sent → delivered → read (+ failed em qualquer ponto).
- Casamento por `wamid` é obrigatório.
- Falha >3% = investigar imediatamente.
$md$ WHERE modulo_id = 4 AND numero = 2;

-- 4.3
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Cada status tem um significado operacional diferente. Confundir "entregue" com "lido" leva a decisões erradas de cobrança e retrabalho no time.

## Diagnóstico rápido
- **Sent**: sua infra e a Meta estão OK. Se ficar preso aqui, o problema é na Meta.
- **Delivered**: aparelho do cliente online e recebendo. Se muitos ficam em `sent` sem virar `delivered`, cheque bloqueios.
- **Read**: cliente engajou. Boa métrica de qualidade da lista.
- **Failed**: pode ser número inválido, cliente bloqueou o remetente, ou template não aprovado no idioma.

## Códigos de erro comuns
| Código | Causa |
| --- | --- |
| 131026 | Destinatário sem WhatsApp |
| 131047 | Fora da janela de 24h e sem template |
| 132000 | Template com número errado de variáveis |
| 132001 | Template não existe na WABA |
| 470 | Janela de reengajamento expirada |

> ⚠️ Muitos `131026` em sequência = base suja. Limpe a lista antes de continuar disparando.

## Boas práticas
- Dashboard com % de cada status por dia/número.
- Alerta automático quando `failed` > 5%.
- Segregar erros por código para ação específica.

## Resumo
- Cada status tem uma ação de negócio.
- Códigos numéricos são seu mapa de diagnóstico.
- Falha em massa = pausar e investigar antes de continuar.
$md$ WHERE modulo_id = 4 AND numero = 3;

-- 4.4
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
`quality_rating` e `messaging_limit_tier` são os dois indicadores que decidem se o número cresce ou é rebaixado. Monitorar semanalmente não é opcional.

## Conceitos-chave
- **quality_rating**: GREEN (ótimo), YELLOW (atenção), RED (crítico).
- **messaging_limit_tier**: capacidade atual (250 / 1k / 10k / 100k / ilimitado).
- Ambos são reavaliados **continuamente** pela Meta.

## Como monitorar
1. Endpoint `GET /{phone_number_id}?fields=quality_rating,messaging_limit_tier`.
2. Rodar a cada 6h (webhook `phone_number_quality_update` também avisa).
3. Salvar histórico para ver tendência (não só o valor atual).

## O que derruba a qualidade
- Alta taxa de bloqueio pelos clientes.
- Muitas denúncias como spam.
- Conteúdo repetitivo (mesmo texto para muitos).
- Enviar Marketing sem opt-in claro.

> 💡 GREEN por 7 dias + alto volume = promoção automática de tier. YELLOW por 3 dias = risco imediato.

## Boas práticas
- Painel único com quality + tier + volume dos últimos 30 dias.
- Alerta quando quality cair de GREEN para YELLOW.
- Pausar campanhas de marketing quando quality YELLOW.

## Resumo
- Quality e Tier caminham juntos.
- Monitor por webhook + polling.
- Reação rápida ao YELLOW evita RED.
$md$ WHERE modulo_id = 4 AND numero = 4;

-- 4.5
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Reputação alta é resultado de decisões diárias: **para quem**, **o que**, **com que frequência** você manda. Erro em qualquer eixo derruba.

## Regras que protegem reputação
1. **Opt-in claro** — cliente autorizou receber contatos por WhatsApp.
2. **Frequência responsável** — no máximo 1–2 mensagens Marketing por semana.
3. **Conteúdo relevante** — segmentação real, nada de "spray and pray".
4. **Descadastro fácil** — botão "Não quero mais receber" em todo Marketing.
5. **Horário adequado** — evitar madrugada, domingos e feriados.

## Sinais de alerta
- Bloqueios acima de **2%** do volume enviado.
- Quality caiu para YELLOW.
- Templates começando a ser reclassificados sozinhos.
- Aumento súbito de `failed`.

> ⚠️ Um único disparo de 10 mil Marketing sem consentimento pode derrubar meses de reputação.

## Boas práticas
- Aquecer números por 5–7 dias antes de qualquer volume.
- Ter **linha reserva** já aquecida para casos de queda.
- Rodar campanha grande **em fases** (10%, 30%, 100%).
- Nunca comprar lista de telefones.

## Resumo
- Reputação = consentimento + relevância + moderação.
- Bloqueio >2% é bandeira vermelha imediata.
- Reserva aquecida evita interrupção de operação.
$md$ WHERE modulo_id = 4 AND numero = 5;

-- 4.6
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Se você não mede, você não controla. Um dashboard básico transforma operação de WhatsApp em resultado auditável.

## Métricas que importam
- **Volume enviado / entregue / lido** por dia e por número.
- **Custo** por categoria (Utility, Marketing, Auth) e por número.
- **Taxa de resposta** — cliente respondeu dentro de 24h?
- **Taxa de conversão** — do envio ao resultado (pagamento, agendamento, venda).
- **Quality rating** dos últimos 30 dias.
- **Failed rate** por código de erro.

## Estrutura mínima do dashboard
1. Card "Hoje": enviados, entregues, custo, quality.
2. Gráfico 30d: volume por status.
3. Tabela por número: quality + tier + volume + custo.
4. Top templates por conversão.
5. Alerta: números com qualidade caindo.

> 💡 Métrica sem prazo vira decoração. Cada card deve ter janela ("hoje", "7d", "30d") e comparativo ("vs semana passada").

## Boas práticas
- Atualização diária pelo menos.
- Um responsável por olhar quality **toda manhã**.
- Custos revisados **toda sexta**.
- Fechamento mensal com decisão do que continua/muda.

## Resumo
- Meça envio, entrega, custo, qualidade e conversão.
- Alerta > relatório — quem age rápido protege reputação.
- Sem ritmo semanal/mensal, o dashboard some.
$md$ WHERE modulo_id = 4 AND numero = 6;

-- 5.1
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
A API retorna códigos numéricos em erros — decorar não é preciso, ter um guia à mão sim.

## Códigos essenciais
| Código | Significado | Ação |
| --- | --- | --- |
| 100 | Parâmetro inválido | Revisar payload |
| 130429 | Rate limit da Meta | Reduzir frequência |
| 131026 | Destinatário sem WhatsApp | Remover da base |
| 131047 | Fora da janela + sem template | Usar template correto |
| 131051 | Tipo de mensagem não suportado | Revisar payload |
| 132000 | Variáveis do template incorretas | Contar variáveis |
| 132001 | Template não existe | Verificar nome/idioma |
| 132005 | Idioma não suportado no template | Usar pt_BR |
| 190 | Token inválido / expirado | Gerar novo System Token |
| 470 | Janela de reengajamento expirada | Usar template Utility |

> 💡 Guarde essa tabela impressa perto da equipe de operações. Economiza horas de investigação.

## Boas práticas
- Log estruturado do código em cada falha.
- Dashboard de "top erros das últimas 24h".
- Runbook curto por código (o que fazer quando aparecer).

## Resumo
- Códigos numéricos são seu diagnóstico.
- Runbook por código elimina achismo.
- Log estruturado facilita achar padrão.
$md$ WHERE modulo_id = 5 AND numero = 1;

-- 5.2
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Número banido ou restrito é o pesadelo da operação. Reagir bem nas primeiras horas define se você recupera ou não.

## Diagnóstico
- **Restrito**: número ainda envia, mas com limites reduzidos. Recuperável.
- **Banido**: número não envia mais. Precisa de appeal ou substituição.
- **Rebaixado de tier**: envia menos por dia. Recuperável com boa conduta.

## O que fazer imediatamente
1. **Pausar todos os disparos** desse número.
2. Ir no WhatsApp Manager → checar **motivo** (aparece em Status do número).
3. Se restrito → esperar 24–72h **sem enviar nada** e reduzir volume no retorno.
4. Se banido → abrir **appeal** (próxima aula).
5. **Ativar número reserva** para não parar a operação.

> ⚠️ Continuar disparando em número restrito acelera para banimento definitivo.

## Boas práticas
- Sempre ter **2 números aquecidos** por operação crítica.
- Documentar cada incidente (data, motivo, ação, resultado).
- Revisar templates ativos — pode ser um deles o gatilho.

## Resumo
- Restrito ≠ banido. Ações diferentes.
- Reserva aquecida = continuidade de negócio.
- Pausa imediata é regra, não sugestão.
$md$ WHERE modulo_id = 5 AND numero = 2;

-- 5.3
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Appeal é o pedido formal de revisão de banimento. Bem feito, recupera. Mal feito, sela o banimento.

## Passo a passo
1. WhatsApp Manager → **Números → número banido → Solicitar revisão**.
2. Preencher formulário com **contexto do negócio**: o que a empresa faz, quem são os clientes, por que os disparos ocorriam.
3. Anexar **provas de opt-in** dos contatos (prints de cadastro, contrato de serviço, etc.).
4. Explicar **medidas corretivas** que serão adotadas.
5. Enviar e aguardar **48–96h**.

## O que aumenta a chance de sucesso
- Texto **objetivo e profissional** — sem emocional.
- **Provas concretas** — não frases genéricas.
- Reconhecer erro (quando houve) + apresentar plano.
- Manter o **restante da BM limpo** durante a análise.

> 💡 Appeal genérico ("por favor, é meu único número") tem quase 100% de reprovação. Prove contexto real.

## Boas práticas
- Um appeal por caso. Não abra 3 pedidos simultâneos.
- Se recusado, aguardar 30 dias antes de novo appeal.
- Enquanto isso, operar com número reserva.
- Documentar aprendizado para não repetir a causa.

## Resumo
- Appeal só funciona com contexto e provas.
- Um pedido por vez.
- Reserva mantém operação viva durante análise.
$md$ WHERE modulo_id = 5 AND numero = 3;

-- 5.4
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Subir de tier é consequência, não meta. A promoção acontece quando **volume + qualidade** batem simultaneamente por dias seguidos.

## Regras da promoção
1. Usar **próximo do teto** do tier atual por vários dias.
2. Manter **quality_rating GREEN** por pelo menos 7 dias.
3. Baixa taxa de bloqueio (<1% ideal, <2% aceitável).
4. Templates aprovados e sem reclassificação recente.

## Cronograma típico
```text
Dia 1–3  → Aquecer (30–50% do teto)
Dia 4–7  → Chegar a 80–100% do teto com GREEN
Dia 8    → Meta promove automaticamente para o próximo tier
```

> 💡 A promoção **é automática**. Não existe botão "pedir aumento". Se a qualidade sustentar o volume, sobe.

## Boas práticas
- Não pular etapas — chegar a 100k sem consistência derruba de volta.
- Se a promoção não vier em 7–10 dias, revisar quality e templates.
- Ter **2 números** subindo em paralelo dá redundância.

## Resumo
- Promoção = volume próximo do teto + GREEN por dias.
- Automática, sem pedido manual.
- Consistência bate velocidade sempre.
$md$ WHERE modulo_id = 5 AND numero = 4;

-- 5.5
UPDATE public.consultoria_aulas SET conteudo_md = $md$
## Visão geral
Template rejeitado não é o fim — mas insistir do jeito errado bloqueia a fila da WABA inteira.

## Passo a passo de recuperação
1. Ler o **motivo exato** da rejeição (não só "não conforme").
2. Diagnosticar a categoria do problema: **categoria errada**, **conteúdo promocional em Utility**, **link inválido**, **variável sem exemplo**, **idioma errado**.
3. Corrigir **apenas o item apontado** — não reescrever tudo.
4. Renomear se mudar categoria (`_v2`, `_utility` etc.).
5. Enviar de novo.
6. Se rejeitar novamente pelo mesmo motivo, **reescrever completo do zero**.

## Erros que te fazem perder tempo
- Reenviar o mesmo template com espaço a mais.
- Tentar 3 vezes o mesmo texto esperando resultado diferente.
- Cadastrar em outra WABA "para tentar a sorte".
- Encurtar link.

> ⚠️ Após 3 rejeições seguidas na WABA, novos templates entram numa **fila mais lenta**. Não desperdice tentativas.

## Boas práticas
- Manter planilha de "templates rejeitados + motivo + correção aplicada".
- Antes de reenviar, ler novamente as diretrizes oficiais da Meta.
- Testar em número de sandbox depois de aprovar.

## Resumo
- Corrigir o item exato, não reescrever tudo.
- Repetição sem análise piora a fila.
- Documentar aprendizado protege a operação.
$md$ WHERE modulo_id = 5 AND numero = 5;
