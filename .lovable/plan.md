

## Adicionar logo da Novo Mundo

### Alteracoes

1. **Copiar o arquivo** `user-uploads://partner-12.png` para `src/assets/logo-novo-mundo.png`

2. **Atualizar `src/lib/credorConfig.ts`**:
   - Importar a nova logo: `import logoNovoMundo from '@/assets/logo-novo-mundo.png'`
   - Substituir os placeholders vazios (`''`) nos campos `logos.principal` e `logos.negociacao` do credor `novomundo` pela nova logo

Isso fara com que a logo apareca automaticamente tanto no card da pagina seletora (`/`) quanto no portal do Novo Mundo (`/novomundo`) e na pagina de resultado de consulta.

