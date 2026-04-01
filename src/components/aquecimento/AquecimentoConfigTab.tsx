import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

interface ConfigItem {
  id: string;
  chave: string;
  valor: any;
  descricao: string | null;
}

const DIAS_SEMANA = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
];

export default function AquecimentoConfigTab() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    const { data } = await supabase.from('whatsapp_aquecimento_config' as any).select('*');
    if (data) {
      const items = data as any[];
      setConfigs(items);
      const vals: Record<string, any> = {};
      items.forEach(c => { vals[c.chave] = c.valor; });
      setEditValues(vals);
    }
    setLoading(false);
  }

  function getConfig(chave: string): ConfigItem | undefined {
    return configs.find(c => c.chave === chave);
  }

  function updateLocal(chave: string, valor: any) {
    setEditValues(prev => ({ ...prev, [chave]: valor }));
  }

  async function saveConfig(chave: string) {
    const cfg = getConfig(chave);
    if (!cfg) return;
    await supabase.from('whatsapp_aquecimento_config' as any).update({ valor: editValues[chave] } as any).eq('id', cfg.id);
    toast({ title: 'Configuração salva!' });
    loadConfigs();
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando configurações...</div>;

  const limitesPorFase = editValues['limites_por_fase'] || {};
  const diasPorFase = editValues['dias_por_fase'] || {};
  const horarioComercial = editValues['horario_comercial'] || {};
  const diasAtivos = editValues['dias_ativos'] || [];
  const delayConfig = editValues['delay_config'] || {};

  // Collect known keys to render unknown ones as JSON fallback
  const knownKeys = ['limites_por_fase', 'dias_por_fase', 'horario_comercial', 'dias_ativos', 'delay_config'];
  const unknownConfigs = configs.filter(c => !knownKeys.includes(c.chave));

  return (
    <div className="space-y-6">
      {/* Limites por Fase */}
      {getConfig('limites_por_fase') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Limite de Mensagens por Fase</CardTitle>
            <CardDescription>Quantas mensagens cada número pode enviar por dia em cada fase do aquecimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4].map(fase => (
                <div key={fase} className="space-y-1">
                  <Label className="text-xs">Fase {fase}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={limitesPorFase[String(fase)] ?? ''}
                    onChange={e => updateLocal('limites_por_fase', { ...limitesPorFase, [String(fase)]: Number(e.target.value) })}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Aquecido</Label>
                <Input
                  type="number"
                  min={1}
                  value={limitesPorFase['aquecido'] ?? ''}
                  onChange={e => updateLocal('limites_por_fase', { ...limitesPorFase, aquecido: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button size="sm" onClick={() => saveConfig('limites_por_fase')} className="gap-1">
              <Save className="h-3 w-3" /> Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dias por Fase */}
      {getConfig('dias_por_fase') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dias em Cada Fase</CardTitle>
            <CardDescription>Quantos dias o número precisa ficar em cada fase antes de avançar para a próxima.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(fase => (
                <div key={fase} className="space-y-1">
                  <Label className="text-xs">Fase {fase}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={diasPorFase[String(fase)] ?? ''}
                    onChange={e => updateLocal('dias_por_fase', { ...diasPorFase, [String(fase)]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <Button size="sm" onClick={() => saveConfig('dias_por_fase')} className="gap-1">
              <Save className="h-3 w-3" /> Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Horário Comercial */}
      {getConfig('horario_comercial') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Horário de Funcionamento</CardTitle>
            <CardDescription>O aquecimento só enviará mensagens dentro deste horário. Fora dele, nenhuma mensagem será enviada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={horarioComercial['inicio'] ?? '08:00'}
                  onChange={e => updateLocal('horario_comercial', { ...horarioComercial, inicio: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={horarioComercial['fim'] ?? '18:00'}
                  onChange={e => updateLocal('horario_comercial', { ...horarioComercial, fim: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fuso Horário</Label>
                <Input
                  value={horarioComercial['timezone'] ?? 'America/Sao_Paulo'}
                  onChange={e => updateLocal('horario_comercial', { ...horarioComercial, timezone: e.target.value })}
                />
              </div>
            </div>
            <Button size="sm" onClick={() => saveConfig('horario_comercial')} className="gap-1">
              <Save className="h-3 w-3" /> Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dias Ativos */}
      {getConfig('dias_ativos') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dias Ativos da Semana</CardTitle>
            <CardDescription>Selecione em quais dias da semana o aquecimento deve funcionar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {DIAS_SEMANA.map(dia => {
                const isChecked = Array.isArray(diasAtivos) && diasAtivos.includes(dia.value);
                return (
                  <div key={dia.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(diasAtivos) ? [...diasAtivos] : [];
                        if (checked) {
                          current.push(dia.value);
                        } else {
                          const idx = current.indexOf(dia.value);
                          if (idx >= 0) current.splice(idx, 1);
                        }
                        current.sort((a: number, b: number) => a - b);
                        updateLocal('dias_ativos', current);
                      }}
                    />
                    <Label className="text-sm cursor-pointer">{dia.label}</Label>
                  </div>
                );
              })}
            </div>
            <Button size="sm" onClick={() => saveConfig('dias_ativos')} className="gap-1">
              <Save className="h-3 w-3" /> Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delay Config */}
      {getConfig('delay_config') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Intervalo entre Mensagens</CardTitle>
            <CardDescription>Tempo mínimo e máximo (em segundos) de espera entre o envio de cada mensagem. Valores aleatórios dentro dessa faixa tornam o comportamento mais natural.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="space-y-1">
                <Label className="text-xs">Mínimo (segundos)</Label>
                <Input
                  type="number"
                  min={1}
                  value={delayConfig['min'] ?? ''}
                  onChange={e => updateLocal('delay_config', { ...delayConfig, min: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máximo (segundos)</Label>
                <Input
                  type="number"
                  min={1}
                  value={delayConfig['max'] ?? ''}
                  onChange={e => updateLocal('delay_config', { ...delayConfig, max: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button size="sm" onClick={() => saveConfig('delay_config')} className="gap-1">
              <Save className="h-3 w-3" /> Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fallback para configs desconhecidas */}
      {unknownConfigs.map(cfg => (
        <Card key={cfg.id}>
          <CardHeader>
            <CardTitle className="text-lg">{cfg.chave.replace(/_/g, ' ').toUpperCase()}</CardTitle>
            {cfg.descricao && <CardDescription>{cfg.descricao}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              defaultValue={JSON.stringify(cfg.valor)}
              onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateLocal(cfg.chave, parsed);
                } catch {
                  toast({ title: 'JSON inválido', variant: 'destructive' });
                  return;
                }
              }}
            />
            <Button size="sm" onClick={() => saveConfig(cfg.chave)} className="gap-1">
              <Save className="h-3 w-3" /> Salvar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
