// server.js - Robô CobMais com Playwright
// Execute: node server.js
// Requer: npm install express playwright cors

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let page = null;
let isRunning = false;
let currentStep = '';

// Inicia o navegador
async function initBrowser() {
  browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  console.log('✅ Navegador iniciado');
}

// Status
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    online: true, 
    running: isRunning, 
    step: currentStep 
  });
});

// Execução principal
app.post('/automacao/cobmais', async (req, res) => {
  const { acao, parametros, cobmais_email, cobmais_senha } = req.body;

  if (acao !== 'gerar_boleto') {
    return res.json({ success: false, error: `Ação '${acao}' não suportada` });
  }

  if (isRunning) {
    return res.json({ success: false, error: 'Já existe uma automação em execução' });
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const { cpf, valor_negociado, num_parcelas } = parametros || {};
    
    if (!cpf) throw new Error('CPF não informado');
    if (!valor_negociado) throw new Error('Valor negociado não informado');

    // Limpa CPF - só números
    const cpfLimpo = cpf.replace(/\D/g, '');

    console.log(`\n🚀 Iniciando geração de boleto`);
    console.log(`   CPF: ${cpfLimpo}`);
    console.log(`   Valor: R$ ${valor_negociado}`);
    console.log(`   Parcelas: ${num_parcelas || 1}`);

    // ==========================================
    // PASSO 1: Verificar se está logado
    // ==========================================
    currentStep = 'Passo 1: Verificando login...';
    console.log(`\n[EXECUTANDO] ${currentStep}`);

    try {
      await page.goto('https://app.cobmais.com.br/cob/pesquisa', { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      });
    } catch (e) {
      // Se timeout, tenta navegar mesmo assim
      console.log('⚠️ Timeout na navegação, verificando página...');
    }

    const currentUrl = page.url();

    // Se redirecionou para login ou está na página de login
    if (currentUrl.includes('Account/Login') || currentUrl.includes('login')) {
      // ==========================================
      // PASSO 2: Fazer login
      // ==========================================
      currentStep = 'Passo 2: Fazendo login...';
      console.log(`[EXECUTANDO] ${currentStep}`);

      if (!cobmais_email || !cobmais_senha) {
        throw new Error('Credenciais do CobMais não configuradas');
      }

      // Preenche campo usuário
      await page.waitForSelector('input#Username', { timeout: 10000 });
      await page.fill('input#Username', '');
      await page.fill('input#Username', cobmais_email);

      // Preenche campo senha
      await page.waitForSelector('input#Password', { timeout: 5000 });
      await page.fill('input#Password', '');
      await page.fill('input#Password', cobmais_senha);

      // Clica no botão Entrar
      const btnEntrar = await page.$('button[type="submit"], input[type="submit"]');
      if (btnEntrar) {
        await btnEntrar.click();
      } else {
        // Tenta por texto
        await page.click('button:has-text("Entrar"), a:has-text("Entrar")');
      }

      // Aguarda login completar
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3000);

      const afterLoginUrl = page.url();
      if (afterLoginUrl.includes('Login') || afterLoginUrl.includes('login')) {
        throw new Error('Falha no login - verifique usuário e senha');
      }

      console.log('✅ Login realizado com sucesso');
    } else {
      console.log('✅ Já estava logado');
    }

    // ==========================================
    // PASSO 3: Navegar para a pesquisa
    // ==========================================
    currentStep = 'Passo 3: Navegando para pesquisa...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Garante que está na página de pesquisa
    if (!page.url().includes('/cob/pesquisa')) {
      await page.goto('https://app.cobmais.com.br/cob/pesquisa', { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    console.log('✅ Na página de pesquisa');

    // ==========================================
    // PASSO 4: Pesquisar CPF
    // ==========================================
    currentStep = `Passo 4: Pesquisando CPF ${cpfLimpo}...`;
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Aguarda campo CPF
    await page.waitForSelector('input#txtCPFCNPJ', { timeout: 10000 });
    
    // Limpa e preenche o campo
    await page.fill('input#txtCPFCNPJ', '');
    await page.fill('input#txtCPFCNPJ', cpfLimpo);

    // Clica no botão pesquisar
    await page.waitForSelector('#btnPesquisar', { timeout: 5000 });
    await page.click('#btnPesquisar');

    // Aguarda resultados carregarem
    await page.waitForTimeout(3000);

    console.log('✅ Pesquisa realizada');

    // ==========================================
    // PASSO 5: Selecionar o devedor nos resultados
    // ==========================================
    currentStep = 'Passo 5: Selecionando devedor...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Tenta clicar no primeiro resultado da tabela
    // Procura por links ou linhas clicáveis na tabela de resultados
    const resultSelector = [
      'table tbody tr:first-child td a',
      'table tbody tr:first-child',
      '.table tbody tr:first-child td a',
      '#gridPesquisa tbody tr:first-child td a',
      'a[href*="telecobranca"]',
      'a[href*="Telecobranca"]',
    ];

    let clicked = false;
    for (const sel of resultSelector) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          clicked = true;
          console.log(`   Clicou no resultado: ${sel}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!clicked) {
      // Tenta encontrar qualquer link com o CPF
      try {
        await page.click(`a:has-text("${cpfLimpo.substring(0, 3)}")`);
        clicked = true;
      } catch (e) {
        throw new Error('Nenhum resultado encontrado para o CPF informado');
      }
    }

    // Aguarda página do devedor carregar
    await page.waitForTimeout(4000);
    console.log('✅ Devedor selecionado');

    // ==========================================
    // PASSO 6: Selecionar parcelas
    // ==========================================
    currentStep = 'Passo 6: Selecionando parcelas...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Tenta marcar "Selecionar Todos" ou marcar parcelas individualmente
    const selectAllSelectors = [
      'input[type="checkbox"]#chkAll',
      'input[type="checkbox"][id*="chkAll"]',
      'input[type="checkbox"][id*="selectAll"]',
      'input[type="checkbox"][id*="SelectAll"]',
      '#chkTodos',
      'th input[type="checkbox"]',
    ];

    let selectedAll = false;
    for (const sel of selectAllSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          selectedAll = true;
          console.log(`   Marcou selecionar todos: ${sel}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!selectedAll) {
      // Marca todos os checkboxes de parcelas visíveis
      const checkboxes = await page.$$('table tbody input[type="checkbox"]');
      for (const cb of checkboxes) {
        try {
          await cb.click();
          await page.waitForTimeout(200);
        } catch (e) {
          continue;
        }
      }
      if (checkboxes.length > 0) {
        console.log(`   Marcou ${checkboxes.length} parcelas individualmente`);
      } else {
        console.log('⚠️ Nenhuma parcela encontrada para selecionar');
      }
    }

    await page.waitForTimeout(1000);
    console.log('✅ Parcelas selecionadas');

    // ==========================================
    // PASSO 7: Clicar em Cálculo
    // ==========================================
    currentStep = 'Passo 7: Abrindo cálculo...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    const calcSelectors = [
      'button:has-text("Cálculo")',
      'button:has-text("Calculo")',
      'a:has-text("Cálculo")',
      'a:has-text("Calculo")',
      '#btnCalculo',
      'button[id*="Calculo"]',
      'button[id*="calculo"]',
      'input[value="Cálculo"]',
    ];

    let calcClicked = false;
    for (const sel of calcSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          calcClicked = true;
          console.log(`   Clicou em Cálculo: ${sel}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!calcClicked) {
      throw new Error('Botão "Cálculo" não encontrado na página');
    }

    // Aguarda modal/tela de cálculo abrir
    await page.waitForTimeout(3000);
    console.log('✅ Tela de cálculo aberta');

    // ==========================================
    // PASSO 8: Preencher valor negociado
    // ==========================================
    currentStep = 'Passo 8: Preenchendo valor negociado...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Formata o valor (ex: 1500.00 → 1500,00)
    const valorFormatado = parseFloat(valor_negociado).toFixed(2).replace('.', ',');

    await page.waitForSelector('input#txtValorFinal', { timeout: 10000 });
    
    // Limpa o campo e preenche
    await page.click('input#txtValorFinal', { clickCount: 3 });
    await page.fill('input#txtValorFinal', '');
    await page.type('input#txtValorFinal', valorFormatado, { delay: 50 });

    // Se tem mais de 1 parcela, tenta preencher o campo de parcelas
    if (num_parcelas && num_parcelas > 1) {
      const parcelasSelectors = [
        'input#txtNumeroParcelas',
        'input[id*="parcela"]',
        'input[id*="Parcela"]',
        'select#ddlParcelas',
        'select[id*="parcela"]',
      ];
      
      for (const sel of parcelasSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const tagName = await el.evaluate(e => e.tagName.toLowerCase());
            if (tagName === 'select') {
              await page.selectOption(sel, String(num_parcelas));
            } else {
              await page.click(sel, { clickCount: 3 });
              await page.fill(sel, '');
              await page.type(sel, String(num_parcelas), { delay: 50 });
            }
            console.log(`   Preencheu parcelas: ${num_parcelas}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    await page.waitForTimeout(1000);
    console.log(`✅ Valor preenchido: R$ ${valorFormatado}`);

    // ==========================================
    // PASSO 9: Salvar o acordo
    // ==========================================
    currentStep = 'Passo 9: Salvando acordo...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Configura interceptação de PDF antes de salvar
    let boletoUrl = null;
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('gerapdf') || url.includes('GerarPDF') || url.includes('boleto') || url.includes('.pdf')) {
        boletoUrl = url;
        console.log(`   📄 URL do boleto capturada: ${url}`);
      }
    });

    // Também intercepta novos popups/páginas (boleto pode abrir em nova aba)
    const context = page.context();
    context.on('page', async (newPage) => {
      const newUrl = newPage.url();
      console.log(`   📄 Nova aba aberta: ${newUrl}`);
      if (newUrl.includes('gerapdf') || newUrl.includes('GerarPDF') || newUrl.includes('boleto') || newUrl.includes('.pdf')) {
        boletoUrl = newUrl;
      }
      // Aguarda a nova página carregar para pegar a URL final
      try {
        await newPage.waitForLoadState('networkidle', { timeout: 10000 });
        const finalUrl = newPage.url();
        if (finalUrl.includes('gerapdf') || finalUrl.includes('.pdf')) {
          boletoUrl = finalUrl;
          console.log(`   📄 URL final da nova aba: ${finalUrl}`);
        }
      } catch (e) {
        // ignora
      }
    });

    // Clica em salvar
    await page.waitForSelector('#btnSalvarCalc', { timeout: 5000 });
    await page.click('#btnSalvarCalc');

    // Aguarda processamento
    await page.waitForTimeout(5000);

    // Verifica se apareceu erro de e-mail em branco
    try {
      const emailError = await page.$('text=e-mail, text=email, text=Email');
      if (emailError) {
        console.log('⚠️ CobMais pediu e-mail, preenchendo...');
        const emailInputSelectors = [
          'input[type="email"]',
          'input[id*="email"]',
          'input[id*="Email"]',
          'input[name*="email"]',
        ];
        for (const sel of emailInputSelectors) {
          try {
            const el = await page.$(sel);
            if (el) {
              await page.fill(sel, 'email@email.com');
              console.log('   Preencheu e-mail com email@email.com');
              // Clica em salvar novamente
              await page.click('#btnSalvarCalc');
              await page.waitForTimeout(5000);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      // Sem erro de e-mail, continua normalmente
    }

    console.log('✅ Acordo salvo');

    // ==========================================
    // PASSO 10: Capturar URL do boleto
    // ==========================================
    currentStep = 'Passo 10: Capturando boleto...';
    console.log(`[EXECUTANDO] ${currentStep}`);

    // Se ainda não capturou a URL, tenta clicar em "Imprimir" ou "Boleto"
    if (!boletoUrl) {
      const printSelectors = [
        'a:has-text("Imprimir")',
        'button:has-text("Imprimir")',
        'a:has-text("Boleto")',
        'button:has-text("Boleto")',
        'a[href*="gerapdf"]',
        'a[href*="boleto"]',
        'a[href*="GerarPDF"]',
        '#btnImprimir',
        'button[id*="Imprimir"]',
        'a[id*="Imprimir"]',
      ];

      for (const sel of printSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const href = await el.getAttribute('href');
            if (href && (href.includes('gerapdf') || href.includes('.pdf'))) {
              boletoUrl = href.startsWith('http') ? href : `https://app.cobmais.com.br${href}`;
              console.log(`   📄 URL do boleto via href: ${boletoUrl}`);
            } else {
              await el.click();
              console.log(`   Clicou em: ${sel}`);
            }
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Aguarda possível popup/download
      await page.waitForTimeout(5000);
    }

    // Verifica URLs em todas as páginas abertas
    if (!boletoUrl) {
      const pages = context.pages();
      for (const p of pages) {
        const pUrl = p.url();
        if (pUrl.includes('gerapdf') || pUrl.includes('.pdf') || pUrl.includes('boleto')) {
          boletoUrl = pUrl;
          console.log(`   📄 URL do boleto encontrada em aba: ${pUrl}`);
          break;
        }
      }
    }

    const tempo = Date.now() - startTime;

    if (!boletoUrl) {
      console.log('❌ Boleto URL não capturada');
      isRunning = false;
      currentStep = 'Erro: boleto_url não encontrada';
      return res.json({ 
        success: false, 
        error: 'Acordo possivelmente salvo, mas URL do boleto não foi capturada. Verifique manualmente no CobMais.',
        tempo_ms: tempo
      });
    }

    console.log(`\n🎉 Boleto gerado com sucesso!`);
    console.log(`   URL: ${boletoUrl}`);
    console.log(`   Tempo: ${tempo}ms`);

    isRunning = false;
    currentStep = 'Concluído';

    return res.json({
      success: true,
      boleto_url: boletoUrl,
      tempo_ms: tempo
    });

  } catch (err) {
    const tempo = Date.now() - startTime;
    const errorMsg = err.message || 'Erro desconhecido';
    
    console.error(`\n❌ Erro gerar_boleto: ${errorMsg}`);
    
    isRunning = false;
    currentStep = `Erro: ${errorMsg}`;
    
    return res.json({
      success: false,
      error: errorMsg,
      tempo_ms: tempo
    });
  }
});

// Inicia servidor
const PORT = 3001;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🤖 Servidor Playwright rodando na porta ${PORT}`);
    console.log(`📡 Configure o ngrok: ngrok http ${PORT}`);
    console.log(`[IDLE] Pronto para automação\n`);
  });
}).catch(err => {
  console.error('❌ Erro ao iniciar navegador:', err);
  process.exit(1);
});
