import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Terminal, Download } from 'lucide-react';
import { toast } from 'sonner';

const SERVER_JS_CODE = `// server.js - Robô CobMais com Playwright
// Execute: node server.js
// Requer: npm install express playwright

const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ===== CONFIGURAÇÕES =====
const COBMAIS_URL = 'https://app.cobmais.com.br';
const PORT = process.env.PORT || 3001;

let browser = null;
let page = null;
let currentStatus = 'idle';
let currentMessage = '';

// ===== INICIALIZAR NAVEGADOR =====
async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({ 
      headless: false,
      args: ['--start-maximized']
    });
    const context = await browser.newContext({ 
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true 
    });
    page = await context.newPage();
    console.log('✅ Navegador iniciado');
  }
  return page;
}

// ===== HELPERS =====
function updateStatus(status, mensagem) {
  currentStatus = status;
  currentMessage = mensagem;
  console.log(\`[\${status.toUpperCase()}] \${mensagem}\`);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ENDPOINT: STATUS =====
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    online: true,
    currentAction: currentStatus,
    message: currentMessage,
    timestamp: new Date().toISOString()
  });
});

// ===== ENDPOINT: SCREENSHOT =====
app.get('/screenshot', async (req, res) => {
  try {
    if (!page) {
      return res.json({ image: null, url: '', status: currentStatus });
    }
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
    const base64 = \`data:image/jpeg;base64,\${screenshot.toString('base64')}\`;
    res.json({ 
      image: base64, 
      url: page.url(), 
      status: \`\${currentStatus}: \${currentMessage}\` 
    });
  } catch (err) {
    res.json({ image: null, url: '', status: 'erro ao capturar tela' });
  }
});

// ===== ENDPOINT PRINCIPAL =====
app.post('/automacao/cobmais', async (req, res) => {
  const { acao, parametros, cobmais_email, cobmais_senha } = req.body;

  if (acao === 'gerar_boleto') {
    try {
      const result = await gerarBoleto(parametros, cobmais_email, cobmais_senha);
      res.json(result);
    } catch (err) {
      console.error('❌ Erro gerar_boleto:', err.message);
      res.json({ 
        success: false, 
        error: err.message,
        etapa: currentMessage 
      });
    }
  } else {
    res.json({ error: \`Ação desconhecida: \${acao}\` });
  }
});

// ===== FLUXO COMPLETO: GERAR BOLETO =====
async function gerarBoleto({ cpf, valor_final, tipo_pagamento, parcelas }, cobmais_email, cobmais_senha) {
  const pg = await initBrowser();
  const startTime = Date.now();

  if (!cpf) throw new Error('CPF não informado');
  if (!valor_final) throw new Error('Valor final não informado');

  const cpfLimpo = cpf.replace(/\\D/g, '');

  console.log(\`\\n🚀 Iniciando geração de boleto\`);
  console.log(\`   CPF: \${cpfLimpo}\`);
  console.log(\`   Valor: R$ \${valor_final}\`);
  console.log(\`   Parcelas: \${parcelas || 1}\`);

  // ── PASSO 1: Verificar se está logado ──
  updateStatus('executando', 'Passo 1: Verificando login...');

  try {
    await pg.goto(\`\${COBMAIS_URL}/cob/pesquisa\`, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
  } catch (e) {
    console.log('⚠️ Timeout na navegação, verificando página...');
  }

  const currentUrl = pg.url();

  // ── PASSO 2: Login (se necessário) ──
  if (currentUrl.includes('Account/Login') || currentUrl.includes('login')) {
    updateStatus('executando', 'Passo 2: Fazendo login...');

    if (!cobmais_email || !cobmais_senha) {
      throw new Error('Credenciais do CobMais não configuradas');
    }

    await pg.waitForSelector('input#Username', { timeout: 10000 });
    await pg.fill('input#Username', '');
    await pg.fill('input#Username', cobmais_email);

    await pg.waitForSelector('input#Password', { timeout: 5000 });
    await pg.fill('input#Password', '');
    await pg.fill('input#Password', cobmais_senha);

    const btnEntrar = await pg.$('button[type="submit"], input[type="submit"]');
    if (btnEntrar) {
      await btnEntrar.click();
    } else {
      await pg.click('button:has-text("Entrar"), a:has-text("Entrar")');
    }

    await pg.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await delay(3000);

    const afterLoginUrl = pg.url();
    if (afterLoginUrl.includes('Login') || afterLoginUrl.includes('login')) {
      throw new Error('Falha no login - verifique usuário e senha');
    }

    console.log('✅ Login realizado com sucesso');
  } else {
    console.log('✅ Já estava logado');
  }

  // ── PASSO 3: Navegar para pesquisa ──
  updateStatus('executando', 'Passo 3: Navegando para pesquisa...');

  if (!pg.url().includes('/cob/pesquisa')) {
    await pg.goto(\`\${COBMAIS_URL}/cob/pesquisa\`, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    }).catch(() => {});
    await delay(2000);
  }

  console.log('✅ Na página de pesquisa');

  // ── PASSO 4: Pesquisar CPF ──
  updateStatus('executando', \`Passo 4: Pesquisando CPF \${cpfLimpo}...\`);

  await pg.waitForSelector('input#txtCPFCNPJ', { timeout: 10000 });
  await pg.fill('input#txtCPFCNPJ', '');
  await pg.fill('input#txtCPFCNPJ', cpfLimpo);

  await pg.waitForSelector('#btnPesquisar', { timeout: 5000 });
  await pg.click('#btnPesquisar');

  await delay(3000);
  console.log('✅ Pesquisa realizada');

  // ── PASSO 5: Selecionar o devedor ──
  updateStatus('executando', 'Passo 5: Selecionando devedor...');

  const resultSelectors = [
    'table tbody tr:first-child td a',
    'table tbody tr:first-child',
    '#gridPesquisa tbody tr:first-child td a',
    'a[href*="telecobranca"]',
    'a[href*="Telecobranca"]',
  ];

  let clicked = false;
  for (const sel of resultSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.click();
        clicked = true;
        console.log(\`   Clicou no resultado: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!clicked) {
    try {
      await pg.click(\`a:has-text("\${cpfLimpo.substring(0, 3)}")\`);
      clicked = true;
    } catch (e) {
      throw new Error(\`CPF \${cpf} não encontrado no CobMais\`);
    }
  }

  await delay(5000);
  console.log('✅ Devedor selecionado - ficha aberta');

  // ── PASSO 6: Clicar em Cálculo (scroll + click) ──
  updateStatus('executando', 'Passo 6: Abrindo cálculo...');

  const calcSelectors = [
    '#btnCalcular',
    'a#btnCalcular',
    '#divCalculo a',
    '#divCalculo button',
    'a:has-text("Cálculo")',
    'a:has-text("Calculo")',
    'button:has-text("Cálculo")',
  ];

  let calcClicked = false;
  for (const sel of calcSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await delay(500);
        await el.click();
        calcClicked = true;
        console.log(\`   Clicou em Cálculo: \${sel}\`);
        break;
      }
    } catch (e) {
      console.log(\`   Tentativa \${sel} falhou: \${e.message}\`);
      continue;
    }
  }

  if (!calcClicked) {
    console.log('   Tentando via JavaScript...');
    try {
      await pg.evaluate(() => {
        const el = document.querySelector('#btnCalcular') || document.querySelector('a[id="btnCalcular"]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.click();
          return true;
        }
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.textContent && link.textContent.trim().includes('álculo')) {
            link.scrollIntoView({ behavior: 'smooth', block: 'center' });
            link.click();
            return true;
          }
        }
        return false;
      });
      calcClicked = true;
      console.log('   Clicou via JavaScript');
    } catch (e) {
      console.log(\`   JavaScript também falhou: \${e.message}\`);
    }
  }

  if (!calcClicked) {
    throw new Error('Botão "Cálculo" não encontrado na página.');
  }

  await delay(4000);
  console.log('✅ Tela de cálculo aberta');

  // ── PASSO 7: Preencher valor negociado ──
  updateStatus('executando', \`Passo 7: Preenchendo valor R$ \${valor_final}...\`);

  const valorFormatado = parseFloat(valor_final).toFixed(2).replace('.', ',');

  await pg.waitForSelector('input#txtValorFinal', { timeout: 10000 });
  await pg.click('input#txtValorFinal', { clickCount: 3 });
  await pg.fill('input#txtValorFinal', '');
  await pg.type('input#txtValorFinal', valorFormatado, { delay: 50 });

  if (parcelas && parcelas > 1) {
    const parcelasSelectors = [
      'input#txtNumeroParcelas',
      'input[id*="parcela"]',
      'input[id*="Parcela"]',
      'select#ddlParcelas',
    ];

    for (const sel of parcelasSelectors) {
      try {
        const el = await pg.$(sel);
        if (el) {
          const tagName = await el.evaluate(e => e.tagName.toLowerCase());
          if (tagName === 'select') {
            await pg.selectOption(sel, String(parcelas));
          } else {
            await pg.click(sel, { clickCount: 3 });
            await pg.fill(sel, '');
            await pg.type(sel, String(parcelas), { delay: 50 });
          }
          console.log(\`   Preencheu parcelas: \${parcelas}\`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  await delay(1000);
  console.log(\`✅ Valor preenchido: R$ \${valorFormatado}\`);

  // ── PASSO 8: Clicar em Atualizar (botão verde) ──
  updateStatus('executando', 'Passo 8: Clicando em Atualizar...');

  const atualizarSelectors = [
    '#btnAtualizarCalculo',
    'button#btnAtualizarCalculo',
    'button.btn-success:has-text("Atualizar")',
    'button:has-text("Atualizar")',
    'input[value="Atualizar"]',
  ];

  let atualizarClicked = false;
  for (const sel of atualizarSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await delay(300);
        await el.click();
        atualizarClicked = true;
        console.log(\`   Clicou em Atualizar: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!atualizarClicked) {
    console.log('⚠️ Botão Atualizar não encontrado, continuando...');
  }

  await delay(3000);
  console.log('✅ Cálculo atualizado');

  // ── PASSO 9: Salvar o acordo ──
  updateStatus('executando', 'Passo 9: Salvando acordo...');

  let boletoUrl = null;

  pg.on('response', async (response) => {
    const url = response.url();
    if (url.includes('gerapdf') || url.includes('GerarPDF') || url.includes('boleto') || url.includes('.pdf')) {
      boletoUrl = url;
      console.log(\`   📄 URL do boleto capturada via response: \${url}\`);
    }
  });

  const context = pg.context();
  context.on('page', async (newPage) => {
    const newUrl = newPage.url();
    console.log(\`   📄 Nova aba aberta: \${newUrl}\`);
    if (newUrl.includes('gerapdf') || newUrl.includes('GerarPDF') || newUrl.includes('boleto') || newUrl.includes('.pdf')) {
      boletoUrl = newUrl;
    }
    try {
      await newPage.waitForLoadState('networkidle', { timeout: 10000 });
      const finalUrl = newPage.url();
      if (finalUrl.includes('gerapdf') || finalUrl.includes('.pdf')) {
        boletoUrl = finalUrl;
        console.log(\`   📄 URL final da nova aba: \${finalUrl}\`);
      }
    } catch (e) {}
  });

  const btnSalvar = await pg.$('#btnSalvarCalc');
  if (btnSalvar) {
    await btnSalvar.scrollIntoViewIfNeeded();
    await delay(300);
    await btnSalvar.click();
  } else {
    await pg.click('button:has-text("Salvar"), button.btn-primary:has-text("Salvar")');
  }
  await delay(5000);

  // Verificar se CobMais pediu e-mail
  try {
    const emailError = await pg.$('text=e-mail, text=email, text=Email');
    if (emailError) {
      console.log('⚠️ CobMais pediu e-mail, preenchendo email@email.com...');
      const emailInputSelectors = [
        'input[type="email"]',
        'input[id*="email"]',
        'input[id*="Email"]',
        'input[name*="email"]',
      ];
      for (const sel of emailInputSelectors) {
        try {
          const el = await pg.$(sel);
          if (el) {
            await pg.fill(sel, 'email@email.com');
            console.log('   Preencheu e-mail');
            const btnSalvar2 = await pg.$('#btnSalvarCalc');
            if (btnSalvar2) await btnSalvar2.click();
            await delay(5000);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
  } catch (e) {}

  console.log('✅ Acordo salvo');

  // ── PASSO 10: Clicar no dropdown amarelo (Acordo) ──
  updateStatus('executando', 'Passo 10: Abrindo menu de Acordo...');

  await delay(3000);

  const dropdownSelectors = [
    'span.ev-btn.ev-btn-amarelo',
    '.ev-btn-amarelo',
    'button.ev-btn-amarelo',
    'a.ev-btn-amarelo',
    'span.ev-btn:has-text("Acordo")',
  ];

  let dropdownClicked = false;
  for (const sel of dropdownSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await delay(300);
        await el.click();
        dropdownClicked = true;
        console.log(\`   Clicou no dropdown amarelo: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!dropdownClicked) {
    console.log('⚠️ Dropdown amarelo não encontrado');
  }

  await delay(2000);
  console.log('✅ Menu de acordo aberto');

  // ── PASSO 11: Clicar em Emitir Boletos ──
  updateStatus('executando', 'Passo 11: Clicando em Emitir Boletos...');

  const emitirSelectors = [
    'a.gerar-boleto',
    'a:has-text("Emitir Boleto")',
    'a:has-text("Gerar Boleto")',
    'a:has-text("Boleto")',
    'li a.gerar-boleto',
  ];

  let emitirClicked = false;
  for (const sel of emitirSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.click();
        emitirClicked = true;
        console.log(\`   Clicou em Emitir Boletos: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!emitirClicked) {
    console.log('⚠️ Link "Emitir Boletos" não encontrado');
  }

  await delay(3000);
  console.log('✅ Tela de boletos aberta');

  // ── PASSO 12: Selecionar Todos e Imprimir ──
  async function selecionarTodosEImprimir() {
    updateStatus('executando', 'Passo 12: Selecionando boletos e imprimindo...');

    // Marcar "Selecionar Todos" - usar label pois checkbox está em span.nice-checkbox
    const ckbSelectors = [
      'label[for="ckbTodosBoletos"]',
      'label:has-text("Selecionar Todos")',
      '#ckbTodosBoletos',
      'input#ckbTodosBoletos',
    ];

    let selecionouTodos = false;
    for (const sel of ckbSelectors) {
      try {
        const el = await pg.$(sel);
        if (el) {
          await el.scrollIntoViewIfNeeded();
          await delay(300);
          await el.click();
          selecionouTodos = true;
          console.log(\`   Marcou Selecionar Todos: \${sel}\`);
          break;
        }
      } catch (e) { continue; }
    }

    if (!selecionouTodos) {
      try {
        await pg.evaluate(() => {
          const cb = document.querySelector('#ckbTodosBoletos');
          if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); return; }
          const labels = document.querySelectorAll('label');
          for (const l of labels) {
            if (l.textContent && l.textContent.includes('Selecionar Todos')) { l.click(); return; }
          }
        });
        console.log('   Marcou Selecionar Todos via JavaScript');
      } catch (e) {
        console.log('⚠️ Não conseguiu marcar Selecionar Todos');
      }
    }

    await delay(1000);

    // Clicar em Imprimir
    const imprimirSelectors = [
      '#btnConfirmarBoleto',
      'button#btnConfirmarBoleto',
      'button:has-text("Imprimir")',
      'a:has-text("Imprimir")',
    ];

    for (const sel of imprimirSelectors) {
      try {
        const el = await pg.$(sel);
        if (el) {
          await el.scrollIntoViewIfNeeded();
          await delay(300);
          const href = await el.getAttribute('href');
          if (href && (href.includes('gerapdf') || href.includes('.pdf'))) {
            boletoUrl = href.startsWith('http') ? href : \`\${COBMAIS_URL}\${href}\`;
          } else {
            await el.click();
            console.log(\`   Clicou em Imprimir: \${sel}\`);
          }
          break;
        }
      } catch (e) { continue; }
    }

    await delay(5000);

    // Verificar erro de email
    let erroEmail = false;
    try {
      const toastEl = await pg.$('div.toast-message');
      if (toastEl) {
        const toastText = await toastEl.textContent();
        if (toastText && (toastText.toLowerCase().includes('email') || toastText.toLowerCase().includes('e-mail'))) {
          erroEmail = true;
          console.log(\`⚠️ Erro de email: \${toastText}\`);
        }
      }
    } catch (e) {}

    if (erroEmail) {
      console.log('🔄 Recuperação: cadastrar email...');
      updateStatus('executando', 'Cadastrando email do cliente...');

      // Fechar modal
      for (const sel of ['#btnFecharBoleto', 'button:has-text("Cancelar")', 'button.close']) {
        try { const el = await pg.$(sel); if (el) { await el.click(); break; } } catch (e) { continue; }
      }
      await delay(2000);

      // Aba Email
      for (const sel of ['a[href="#tabEmail"]', 'a:has-text("E-mail")', 'a:has-text("Email")']) {
        try { const el = await pg.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await delay(300); await el.click(); break; } } catch (e) { continue; }
      }
      await delay(2000);

      // + Novo
      for (const sel of ['a#btnNovoItem', '#btnNovoItem', 'a:has-text("Novo")']) {
        try { const el = await pg.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await delay(300); await el.click(); break; } } catch (e) { continue; }
      }
      await delay(2000);

      // Preencher email
      for (const sel of ['input#txtEmail', 'input[id*="Email"]', 'input[type="email"]']) {
        try { const el = await pg.$(sel); if (el) { await pg.fill(sel, 'email@email.com'); break; } } catch (e) { continue; }
      }
      await delay(1000);

      // Salvar
      for (const sel of ['button#btnSalvarEmail', '#btnSalvarEmail', 'button:has-text("Salvar")']) {
        try { const el = await pg.$(sel); if (el) { await el.click(); break; } } catch (e) { continue; }
      }
      await delay(3000);
      console.log('✅ Email cadastrado');

      // Refazer emissão
      updateStatus('executando', 'Refazendo emissão de boleto...');
      for (const sel of dropdownSelectors) {
        try { const el = await pg.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await delay(300); await el.click(); break; } } catch (e) { continue; }
      }
      await delay(2000);
      for (const sel of emitirSelectors) {
        try { const el = await pg.$(sel); if (el) { await el.click(); break; } } catch (e) { continue; }
      }
      await delay(3000);

      return await selecionarTodosEImprimir();
    }

    await delay(3000);
  }

  await selecionarTodosEImprimir();

  if (!boletoUrl) {
    const pages = context.pages();
    for (const p of pages) {
      const pUrl = p.url();
      if (pUrl.includes('gerapdf') || pUrl.includes('.pdf') || pUrl.includes('boleto')) {
        boletoUrl = pUrl;
        console.log(\`   📄 URL do boleto encontrada em aba: \${pUrl}\`);
        break;
      }
    }
  }

  const tempo = Date.now() - startTime;

  if (!boletoUrl) {
    console.log('❌ Boleto URL não capturada');
    updateStatus('erro', 'URL do boleto não encontrada');
    return {
      success: false,
      error: 'Acordo possivelmente salvo, mas URL do boleto não foi capturada. Verifique manualmente no CobMais.',
      tempo_ms: tempo
    };
  }

  console.log(\`\\n🎉 Boleto gerado com sucesso!\`);
  console.log(\`   URL: \${boletoUrl}\`);
  console.log(\`   Tempo: \${tempo}ms\`);

  updateStatus('sucesso', \`Boleto gerado! URL: \${boletoUrl}\`);

  return {
    success: true,
    sucesso: true,
    boleto_url: boletoUrl,
    mensagem: \`Boleto gerado com sucesso para CPF \${cpf}\`,
    tempo_ms: tempo
  };
}

// ===== ENDPOINT: AGENTE INTELIGENTE =====
app.post('/automacao/agent', async (req, res) => {
  const { objective, parametros, cobmais_email, cobmais_senha, supabase_url } = req.body;

  if (!objective) {
    return res.json({ success: false, error: 'Campo objective é obrigatório' });
  }

  const MAX_ITERATIONS = 30;
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  const history = [];
  let boletoUrl = null;

  try {
    const pg = await initBrowser();
    updateStatus('agent', \`Agente iniciado: \${objective}\`);

    // Setup PDF/boleto URL interceptor
    pg.on('response', async (response) => {
      const url = response.url();
      if (url.includes('gerapdf') || url.includes('GerarPDF') || url.includes('boleto') || url.includes('.pdf')) {
        boletoUrl = url;
        console.log(\`   📄 [Agent] Boleto URL capturada: \${url}\`);
      }
    });

    const context = pg.context();
    context.on('page', async (newPage) => {
      const newUrl = newPage.url();
      if (newUrl.includes('gerapdf') || newUrl.includes('.pdf') || newUrl.includes('boleto')) {
        boletoUrl = newUrl;
      }
      try {
        await newPage.waitForLoadState('networkidle', { timeout: 10000 });
        const finalUrl = newPage.url();
        if (finalUrl.includes('gerapdf') || finalUrl.includes('.pdf')) {
          boletoUrl = finalUrl;
        }
      } catch (e) {}
    });

    // Inject credentials into objective context
    let fullObjective = objective;
    if (cobmais_email && cobmais_senha) {
      fullObjective += \`\\n\\nCredenciais CobMais: usuário="\${cobmais_email}", senha="\${cobmais_senha}"\`;
    }
    if (parametros) {
      fullObjective += \`\\nParâmetros: \${JSON.stringify(parametros)}\`;
    }

    const analyzeUrl = \`\${supabase_url || process.env.SUPABASE_URL || 'https://cymdrkeukockakfzjeen.supabase.co'}/functions/v1/analyze-cobmais-screen\`;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        updateStatus('erro', 'Timeout: agente excedeu 5 minutos');
        return res.json({
          success: false,
          error: 'Timeout: agente excedeu limite de 5 minutos',
          history,
          iterations: i,
          tempo_ms: Date.now() - startTime,
        });
      }

      updateStatus('agent', \`Iteração \${i + 1}/\${MAX_ITERATIONS}: analisando tela...\`);

      // 1. Capture screenshot
      let screenshot;
      try {
        const screenshotBuffer = await pg.screenshot({ type: 'jpeg', quality: 40 });
        screenshot = \`data:image/jpeg;base64,\${screenshotBuffer.toString('base64')}\`;
      } catch (e) {
        console.log('❌ Erro ao capturar screenshot:', e.message);
        history.push({ action: 'screenshot_error', description: 'Falha ao capturar tela', result: e.message });
        continue;
      }

      const currentUrl = pg.url();

      // 2. Call AI
      let aiAction;
      try {
        const aiRes = await fetch(analyzeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot,
            objective: fullObjective,
            history,
            current_url: currentUrl,
          }),
          signal: AbortSignal.timeout(30000),
        });
        const aiData = await aiRes.json();
        if (!aiData.success || !aiData.action) {
          console.log('⚠️ IA não retornou ação válida:', JSON.stringify(aiData));
          history.push({ action: 'ai_error', description: 'IA não retornou ação válida', result: aiData.error || 'unknown' });
          await delay(2000);
          continue;
        }
        aiAction = aiData.action;
      } catch (e) {
        console.log('❌ Erro ao chamar IA:', e.message);
        history.push({ action: 'ai_call_error', description: 'Falha na chamada da IA', result: e.message });
        await delay(3000);
        continue;
      }

      console.log(\`🤖 [Agent \${i + 1}] \${aiAction.action}: \${aiAction.description} (conf: \${aiAction.confidence})\`);

      // 3. Check confidence threshold
      if (aiAction.confidence < 0.7 && aiAction.action !== 'done' && aiAction.action !== 'error') {
        console.log(\`⚠️ Confiança baixa (\${aiAction.confidence}), parando para revisão humana\`);
        history.push({
          action: aiAction.action,
          description: aiAction.description,
          result: \`Parado: confiança baixa (\${aiAction.confidence})\`,
        });
        updateStatus('paused', \`Confiança baixa (\${aiAction.confidence}) - revisão necessária\`);
        return res.json({
          success: false,
          error: \`Agente parou: confiança baixa (\${aiAction.confidence}). Ação sugerida: \${aiAction.description}\`,
          suggested_action: aiAction,
          history,
          iterations: i + 1,
          tempo_ms: Date.now() - startTime,
        });
      }

      // 4. Check if done
      if (aiAction.done || aiAction.action === 'done') {
        updateStatus('sucesso', \`Agente concluiu: \${aiAction.description}\`);
        const finalBoletoUrl = aiAction.result_data?.boleto_url || boletoUrl;
        history.push({ action: 'done', description: aiAction.description, result: 'concluido' });
        return res.json({
          success: true,
          boleto_url: finalBoletoUrl || null,
          mensagem: aiAction.description,
          result_data: aiAction.result_data || {},
          history,
          iterations: i + 1,
          tempo_ms: Date.now() - startTime,
        });
      }

      // 5. Check if error
      if (aiAction.action === 'error') {
        updateStatus('erro', aiAction.error_message || aiAction.description);
        history.push({ action: 'error', description: aiAction.description, result: aiAction.error_message });
        return res.json({
          success: false,
          error: aiAction.error_message || aiAction.description,
          history,
          iterations: i + 1,
          tempo_ms: Date.now() - startTime,
        });
      }

      // 6. Execute action
      let actionResult = 'ok';
      try {
        switch (aiAction.action) {
          case 'click': {
            const el = await pg.$(aiAction.selector);
            if (el) {
              await el.scrollIntoViewIfNeeded();
              await delay(300);
              await el.click();
            } else {
              const clicked = await pg.evaluate((sel) => {
                const e = document.querySelector(sel);
                if (e) { e.scrollIntoView({ block: 'center' }); e.click(); return true; }
                return false;
              }, aiAction.selector);
              if (!clicked) actionResult = \`Elemento não encontrado: \${aiAction.selector}\`;
            }
            await delay(2000);
            break;
          }
          case 'fill': {
            await pg.waitForSelector(aiAction.selector, { timeout: 5000 });
            await pg.click(aiAction.selector, { clickCount: 3 });
            await pg.fill(aiAction.selector, '');
            await pg.type(aiAction.selector, aiAction.value || '', { delay: 50 });
            await delay(500);
            break;
          }
          case 'scroll': {
            const dir = (aiAction.value || 'down').toLowerCase();
            await pg.evaluate((direction) => {
              window.scrollBy(0, direction === 'up' ? -400 : 400);
            }, dir);
            await delay(1000);
            break;
          }
          case 'wait': {
            const waitMs = parseInt(aiAction.value || '3000', 10);
            await delay(Math.min(waitMs, 10000));
            break;
          }
          case 'navigate': {
            await pg.goto(aiAction.value || '', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await delay(2000);
            break;
          }
          case 'select': {
            await pg.selectOption(aiAction.selector, aiAction.value || '');
            await delay(1000);
            break;
          }
          default:
            actionResult = \`Ação desconhecida: \${aiAction.action}\`;
        }
      } catch (e) {
        actionResult = \`Erro: \${e.message}\`;
        console.log(\`❌ Erro ao executar \${aiAction.action}: \${e.message}\`);
      }

      history.push({
        action: aiAction.action,
        selector: aiAction.selector,
        value: aiAction.value,
        description: aiAction.description,
        confidence: aiAction.confidence,
        result: actionResult,
      });

      updateStatus('agent', \`Iteração \${i + 1}: \${aiAction.description} → \${actionResult}\`);
    }

    // Max iterations reached
    updateStatus('erro', 'Agente atingiu limite de iterações');
    return res.json({
      success: false,
      error: 'Agente atingiu o limite máximo de 30 iterações',
      history,
      iterations: MAX_ITERATIONS,
      tempo_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('❌ Erro no agente:', err.message);
    return res.json({
      success: false,
      error: err.message,
      history,
      tempo_ms: Date.now() - startTime,
    });
  }
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, async () => {
  console.log(\`\\n🤖 Servidor Playwright rodando na porta \${PORT}\`);
  console.log(\`📡 Configure o ngrok: ngrok http \${PORT}\\n\`);

  try {
    await initBrowser();
    updateStatus('idle', 'Pronto para automação');
  } catch (err) {
    console.error('Erro ao iniciar navegador:', err.message);
  }
});

// Cleanup ao fechar
process.on('SIGINT', async () => {
  console.log('\\n🛑 Fechando navegador...');
  if (browser) await browser.close();
  process.exit();
});\`;

export function RoboCodeViewer() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SERVER_JS_CODE);
    setCopied(true);
    toast.success('Código copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const blob = new Blob([SERVER_JS_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server.js';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo server.js baixado!');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Código do Robô (server.js)
            </CardTitle>
            <CardDescription className="mt-1">
              Copie este código e salve como <code className="bg-muted px-1 rounded">server.js</code> no seu computador
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
            <Button size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copiado!' : 'Copiar Código'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <p className="text-sm font-medium">📋 Instruções rápidas:</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Copie ou baixe o código abaixo</li>
            <li>Salve como <code className="bg-muted px-1 rounded">server.js</code></li>
            <li>Execute: <code className="bg-muted px-1 rounded">npm install express playwright</code></li>
            <li>Execute: <code className="bg-muted px-1 rounded">npx playwright install chromium</code></li>
            <li>Inicie: <code className="bg-muted px-1 rounded">node server.js</code></li>
            <li>Configure o ngrok: <code className="bg-muted px-1 rounded">ngrok http 3001</code></li>
          </ol>
        </div>

        <ScrollArea className="h-[500px] rounded-md border bg-muted p-4">
          <pre className="text-xs text-primary font-mono whitespace-pre-wrap">{SERVER_JS_CODE}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
