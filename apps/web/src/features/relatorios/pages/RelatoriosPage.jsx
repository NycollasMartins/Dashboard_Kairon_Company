import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Sparkles, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import { queryKeys } from '@/entities/query-keys';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { leadsApi } from '@/features/comercial/api/leads.api';
import { financeiroApi, custosApi } from '@/features/financeiro/api/financeiro.api';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { campanhasApi } from '@/features/campanhas/api/campanhas.api';
import { metasApi, competenciaDoMes } from '@/features/metas/api/metas.api';
import { rotuloCompetencia } from '@/features/metas/lib/metas.calc';
import { montarResumo } from '@/features/relatorios/lib/aggregate';
import { relatoriosApi } from '@/features/relatorios/api/relatorios.api';
import ReportBlocks from '@/features/relatorios/components/ReportBlocks';

export default function RelatoriosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const competencia = competenciaDoMes(new Date());
  const periodoLabel = rotuloCompetencia(competencia);

  // Todas as fontes de dados do dashboard.
  const { data: clientes = [] } = useQuery({ queryKey: queryKeys.clientes.all, queryFn: clientesApi.list, enabled: isAdmin });
  const { data: leads = [] } = useQuery({ queryKey: queryKeys.leads.all, queryFn: leadsApi.list, enabled: isAdmin });
  const { data: metrics = [] } = useQuery({ queryKey: queryKeys.financeiro.metrics, queryFn: financeiroApi.listCampaignMetrics, enabled: isAdmin });
  const { data: custos = [] } = useQuery({ queryKey: queryKeys.financeiro.custos, queryFn: custosApi.list, enabled: isAdmin });
  const { data: vendas = [] } = useQuery({ queryKey: queryKeys.metas.vendas(competencia), queryFn: () => metasApi.listVendasDoMes(competencia), enabled: isAdmin });
  const { data: metas = [] } = useQuery({ queryKey: queryKeys.metas.all, queryFn: metasApi.listMetas, enabled: isAdmin });
  const { data: closers = [] } = useQuery({ queryKey: queryKeys.metas.closers, queryFn: metasApi.listClosers, enabled: isAdmin });
  const { data: mrrBase = 0 } = useQuery({ queryKey: queryKeys.metas.mrrBase, queryFn: metasApi.mrrBase, enabled: isAdmin });
  const { data: tarefas = [] } = useQuery({ queryKey: queryKeys.tarefas.all, queryFn: tarefasApi.list, enabled: isAdmin });
  const { data: campanhas = [] } = useQuery({ queryKey: queryKeys.campanhas.all, queryFn: campanhasApi.list, enabled: isAdmin });

  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [report, setReport] = useState(null); // { resumo, blocks }
  const [geradoEm, setGeradoEm] = useState(null);
  const reportRef = useRef(null);

  const gerar = async () => {
    setGerando(true);
    try {
      const summary = montarResumo({
        clientes, leads, metrics, custos, vendas, metas, closers, mrrBase, tarefas, campanhas,
        competencia, now: new Date(),
      });
      const result = await relatoriosApi.gerar(summary, periodoLabel);
      setReport(result);
      setGeradoEm(new Date());
      toast({ title: 'Relatório gerado!' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível gerar o relatório', description: err?.message });
    } finally {
      setGerando(false);
    }
  };

  const baixarPDF = async () => {
    if (!reportRef.current) return;
    setBaixando(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#0d0d0d', useCORS: true });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pw) / canvas.width;
      let heightLeft = imgH;
      let pos = 0;
      pdf.addImage(img, 'PNG', 0, pos, pw, imgH);
      heightLeft -= ph;
      while (heightLeft > 0) {
        pos = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 0, pos, pw, imgH);
        heightLeft -= ph;
      }
      pdf.save(`relatorio-kairon-${competencia.slice(0, 7)}.pdf`);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível gerar o PDF', description: err?.message });
    } finally {
      setBaixando(false);
    }
  };

  if (!isAdmin) {
    return <RestrictedAccessCard description="Apenas administradores podem acessar os Relatórios." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="-mt-24 -mx-6">
        <div className="relative h-44 rounded-b-3xl overflow-hidden" style={{ backgroundImage: "url('/kairon-company-dark.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/75 pointer-events-none" />
        </div>
        <div className="px-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-full bg-[#0d0d0d] border-2 border-white/10 flex items-center justify-center shadow-xl shadow-black/50">
            <FileText className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="px-6 mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Relatório executivo de todo o dashboard gerado por IA — financeiro, metas, comercial, campanhas e operação.
              Período de referência: {periodoLabel}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={gerar} disabled={gerando} className="bg-[#EA3935] hover:bg-[#d32f2c] text-white h-9">
              {gerando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              {gerando ? 'Gerando...' : (report ? 'Gerar novamente' : 'Gerar relatório')}
            </Button>
            {report && (
              <Button onClick={baixarPDF} disabled={baixando} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9">
                {baixando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                Baixar PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {!report && !gerando && (
        <div className="glass-card rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EA3935]/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-[#EA3935]" />
          </div>
          <p className="text-white font-medium">Nenhum relatório gerado ainda</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Clique em “Gerar relatório” para que a IA analise os dados de {periodoLabel} e monte uma visão completa, com textos e gráficos.
          </p>
        </div>
      )}

      {gerando && (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#EA3935] animate-spin mx-auto mb-3" />
          <p className="text-white font-medium">Analisando o dashboard e montando o relatório…</p>
          <p className="text-sm text-muted-foreground mt-1">Isso pode levar alguns segundos.</p>
        </div>
      )}

      {report && (
        <div ref={reportRef} className="space-y-4 p-6 rounded-2xl" style={{ backgroundColor: '#0d0d0d' }}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#EA3935] font-semibold">Kairon Company · Relatório executivo</p>
              <h2 className="text-2xl font-bold text-white tracking-tight mt-1">{periodoLabel}</h2>
            </div>
            {geradoEm && (
              <p className="text-[11px] text-muted-foreground text-right">
                Gerado em<br />{geradoEm.toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          {report.resumo && (
            <div className="glass-card rounded-2xl border border-[#EA3935]/20 bg-[#EA3935]/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-wider text-[#EA3935] font-medium mb-1.5">Resumo executivo</p>
              <p className="text-sm text-white/90 leading-relaxed">{report.resumo}</p>
            </div>
          )}

          <ReportBlocks blocks={report.blocks} />

          <p className="text-[10px] text-muted-foreground/60 text-center pt-4">
            Relatório gerado por IA com base nos dados do dashboard. Confira os números antes de decisões críticas.
          </p>
        </div>
      )}
    </div>
  );
}
