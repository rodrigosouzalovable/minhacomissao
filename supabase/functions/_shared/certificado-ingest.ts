// Lógica compartilhada de coleta/gravação de leads do Certificado Digital.
import { buscarCasaDosDados, ehCelular, type LeadBruto } from "./casa-dos-dados.ts";

export interface ConfigCert {
  id: string;
  motor_ativo: boolean;
  ufs: string[];
  cnaes: string[];
  janelas_dias: number[];
  somente_mei: boolean;
  somente_celular: boolean;
}

export interface ResultadoJanela {
  janela: number;
  data_referencia: string;
  encontrados: number;
  novos: number;
  duplicados: number;
  sem_telefone: number;
  erro?: string;
}

/** Data (yyyy-mm-dd) de "hoje menos N dias" no fuso de São Paulo. */
export function dataBRT(diasAtras: number): string {
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  agora.setUTCDate(agora.getUTCDate() - diasAtras);
  return agora.toISOString().slice(0, 10);
}

function sufixo8(tel: string) {
  const d = tel.replace(/\D/g, "");
  return d.slice(-8);
}

export async function coletarJanela(
  supabase: any,
  cfg: ConfigCert,
  janela: number,
  manual: boolean,
): Promise<ResultadoJanela> {
  const dataRef = dataBRT(janela);
  const res: ResultadoJanela = {
    janela,
    data_referencia: dataRef,
    encontrados: 0,
    novos: 0,
    duplicados: 0,
    sem_telefone: 0,
  };

  try {
    const brutos: LeadBruto[] = [];
    const limite = 100;
    for (let pagina = 1; pagina <= 10; pagina++) {
      const { leads, total } = await buscarCasaDosDados({
        ufs: cfg.ufs,
        cnaes: cfg.cnaes,
        dataInicio: dataRef,
        dataFim: dataRef,
        somenteMei: cfg.somente_mei,
        somenteCelular: cfg.somente_celular,
        pagina,
        limite,
      });
      brutos.push(...leads);
      if (leads.length < limite || brutos.length >= total) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    res.encontrados = brutos.length;
    if (!brutos.length) {
      await registrarLog(supabase, res, manual);
      return res;
    }

    const cnpjs = brutos.map((b) => b.cnpj);
    const existentes = new Set<string>();
    for (let i = 0; i < cnpjs.length; i += 500) {
      const { data } = await supabase
        .from("certificado_leads")
        .select("cnpj")
        .in("cnpj", cnpjs.slice(i, i + 500));
      (data ?? []).forEach((r: any) => existentes.add(r.cnpj));
    }

    // Blacklist por sufixo de telefone
    const sufixos = [...new Set(brutos.flatMap((b) => b.telefones.map(sufixo8)).filter(Boolean))];
    const bloqueados = new Set<string>();
    for (let i = 0; i < sufixos.length; i += 500) {
      const { data } = await supabase
        .from("meta_destinatario_supressao")
        .select("telefone_sufixo")
        .in("telefone_sufixo", sufixos.slice(i, i + 500));
      (data ?? []).forEach((r: any) => bloqueados.add(r.telefone_sufixo));
    }

    const novos: any[] = [];
    for (const b of brutos) {
      if (existentes.has(b.cnpj)) {
        res.duplicados++;
        continue;
      }
      const celulares = b.telefones.filter(ehCelular);
      const principal = celulares[0] ?? b.telefones[0] ?? null;
      let situacao = "novo";
      if (!principal) {
        situacao = "sem_telefone";
        res.sem_telefone++;
      } else if (bloqueados.has(sufixo8(principal))) {
        situacao = "blacklist";
      }

      novos.push({
        cnpj: b.cnpj,
        razao_social: b.razao_social,
        nome_fantasia: b.nome_fantasia,
        telefones: b.telefones,
        telefone_principal: principal,
        email: b.email,
        cnae: b.cnae,
        cnae_descricao: b.cnae_descricao,
        uf: b.uf,
        municipio: b.municipio,
        porte: b.porte,
        mei: b.mei,
        data_abertura: b.data_abertura ? String(b.data_abertura).slice(0, 10) : dataRef,
        dias_desde_abertura: janela,
        origem_janela: janela,
        situacao,
      });
    }

    for (let i = 0; i < novos.length; i += 200) {
      const lote = novos.slice(i, i + 200);
      const { error } = await supabase
        .from("certificado_leads")
        .upsert(lote, { onConflict: "cnpj", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      res.novos += lote.length;
    }
  } catch (e) {
    res.erro = e instanceof Error ? e.message : String(e);
  }

  await registrarLog(supabase, res, manual);
  return res;
}

async function registrarLog(supabase: any, res: ResultadoJanela, manual: boolean) {
  await supabase.from("certificado_coleta_log").insert({
    janela: res.janela,
    data_referencia: res.data_referencia,
    encontrados: res.encontrados,
    novos: res.novos,
    duplicados: res.duplicados,
    sem_telefone: res.sem_telefone,
    erro: res.erro ?? null,
    manual,
  });
}
