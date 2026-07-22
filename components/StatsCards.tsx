import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  FileClock,
  PiggyBank,
  Receipt,
  Store,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Requisition, StatsData } from '../types';

interface StatsCardsProps {
  requisitions: Requisition[];
  stats: StatsData;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value);

export const StatsCards: React.FC<StatsCardsProps> = ({ requisitions, stats }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredData = useMemo(() => requisitions.filter(item => {
    if (startDate && item.requestDate < startDate) return false;
    if (endDate && item.requestDate > endDate) return false;
    return true;
  }), [endDate, requisitions, startDate]);

  const completedItems = useMemo(
    () => filteredData.filter(item => item.status === 'Comprado' || item.status === 'Entregue'),
    [filteredData],
  );

  const totalCost = completedItems.reduce((total, item) => (
    total + (item.purchaseInvoice?.grossTotal ?? Math.round((item.finalCost || 0) * item.quantity * 100) / 100)
  ), 0);

  const totalSaving = completedItems.reduce((total, item) => {
    if (!item.quotes || item.quotes.length <= 1) return total;
    const winner = item.quotes.find(quote => quote.isSelected);
    if (!winner) return total;
    const highestOffer = Math.max(...item.quotes.map(quote => quote.price));
    return total + Math.max(0, Math.round((highestOffer - winner.price) * item.quantity * 100) / 100);
  }, 0);

  const averageTicket = completedItems.length ? totalCost / completedItems.length : 0;
  const savingBase = totalCost + totalSaving;
  const savingPercentage = savingBase > 0 ? Math.round((totalSaving / savingBase) * 100) : 0;

  const topSupplier = useMemo(() => {
    const suppliers: Record<string, number> = {};
    completedItems.forEach(item => {
      const winner = item.quotes?.find(quote => quote.isSelected);
      if (!winner) return;
      const value = item.purchaseInvoice?.grossTotal ?? (item.finalCost || winner.price) * item.quantity;
      suppliers[winner.supplierName] = (suppliers[winner.supplierName] || 0) + value;
    });
    return Object.entries(suppliers).reduce(
      (top, [name, value]) => value > top.value ? { name, value } : top,
      { name: 'Sem fornecedor', value: 0 },
    );
  }, [completedItems]);

  const supplierShare = totalCost > 0 ? Math.round((topSupplier.value / totalCost) * 100) : 0;

  const timelineData = useMemo(() => {
    const grouped: Record<string, { date: string; saving: number; gasto: number }> = {};
    completedItems.forEach(item => {
      if (!item.requestDate) return;
      if (!grouped[item.requestDate]) grouped[item.requestDate] = { date: item.requestDate, saving: 0, gasto: 0 };
      const winner = item.quotes?.find(quote => quote.isSelected);
      const highestOffer = item.quotes?.length ? Math.max(...item.quotes.map(quote => quote.price)) : 0;
      grouped[item.requestDate].saving += winner ? Math.max(0, (highestOffer - winner.price) * item.quantity) : 0;
      grouped[item.requestDate].gasto += item.purchaseInvoice?.grossTotal ?? (item.finalCost || 0) * item.quantity;
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [completedItems]);

  const departmentData = useMemo(() => {
    const grouped: Record<string, number> = {};
    completedItems.forEach(item => {
      const value = item.purchaseInvoice?.grossTotal ?? (item.finalCost || 0) * item.quantity;
      grouped[item.department] = (grouped[item.department] || 0) + value;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [completedItems]);

  const exportPDF = async () => {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) return;
    const canvas = await html2canvas(dashboard, { scale: 2, backgroundColor: '#f8fafc' });
    const image = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.text(`DM Intelligence — Dashboard de Saving`, 10, 10);
    pdf.text(`Período: ${startDate || 'início'} a ${endDate || 'hoje'}`, 10, 16);
    pdf.addImage(image, 'PNG', 0, 22, width, height);
    pdf.save('dashboard-saving.pdf');
  };

  const operationalIndicators = [
    { label: 'Aguardando NF', value: String(stats.awaitingInvoiceCount || 0), icon: FileClock, background: 'bg-[#E6530D]', badge: '≤ 2 dias', detail: 'Pendente de emissão' },
    { label: 'Divergências', value: String(stats.invoiceDivergenceCount || 0), icon: CheckCircle2, background: 'bg-[#138F82]', badge: 'Auditado', detail: 'Nenhuma divergência' },
    { label: 'Variação cotação × NF', value: formatCurrency(stats.invoiceVarianceTotal || 0), icon: ArrowUpRight, background: 'bg-[#0788BE]', badge: 'No limite', detail: 'Valor realizado' },
    { label: 'Prazo médio de entrega', value: `${Math.round(stats.averageLeadTime || 0)} dias`, icon: Clock3, background: 'bg-[#4A3AC2]', badge: 'Meta 5 dias', detail: 'Prazo realizado' },
  ];

  return (
    <div id="dashboard-content" className="space-y-6 pb-12 animate-in fade-in duration-500">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-soft sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">Desempenho de compras</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Saving, gasto realizado e eficiência no período.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">De</span>
            <input aria-label="Data inicial" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="min-w-0 bg-transparent text-xs font-bold text-slate-700 outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Até</span>
            <input aria-label="Data final" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="min-w-0 bg-transparent text-xs font-bold text-slate-700 outline-none" />
          </label>
          {(startDate || endDate) && (
            <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }} className="flex h-10 items-center justify-center rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-100" title="Limpar período">
              <XCircle className="mr-1.5 h-4 w-4" /> Limpar
            </button>
          )}
          <button type="button" onClick={exportPDF} className="flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </button>
        </div>
      </section>

      <section className="rounded-[2.25rem] bg-[#111827] p-3 shadow-2xl shadow-slate-300/70 sm:p-4">
        <div className="mb-5 flex flex-col gap-1 px-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-400">Visão executiva</p>
            <h2 className="mt-1 text-xl font-black text-white">Dashboard de Saving</h2>
          </div>
          <p className="text-xs font-semibold text-slate-400">{completedItems.length} pedidos concluídos no período</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="group relative min-h-[178px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#009E68] p-4 text-white shadow-xl shadow-emerald-950/30 sm:p-5">
            <PiggyBank className="absolute -right-2 top-7 h-24 w-24 text-white opacity-[0.14] transition-transform duration-500 group-hover:-translate-x-2" strokeWidth={1.5} />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15"><TrendingUp className="h-4 w-4" /></span>
                <span className="rounded-full border border-white/15 bg-white/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide">Negociação: {savingPercentage}%</span>
              </div>
              <div className="mt-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">Saving gerado</p>
                <p className="mt-1 text-2xl font-black tracking-tight">{formatCurrency(totalSaving)}</p>
                <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-white/20 pt-2.5 text-[7px] font-extrabold text-emerald-50">
                  <span className="flex min-w-0 items-center gap-1"><ArrowUpRight className="h-3 w-3 shrink-0" /> <span>Oferta inicial vs. fechamento</span></span>
                  <span className="shrink-0">Meta: R$ 500</span>
                </div>
              </div>
            </div>
          </article>

          <article className="group relative min-h-[178px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#285BD4] p-4 text-white shadow-xl shadow-blue-950/30 sm:p-5">
            <DollarSign className="absolute -right-1 top-7 h-24 w-24 text-white opacity-[0.12] transition-transform duration-500 group-hover:-translate-x-2" strokeWidth={1.5} />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15"><DollarSign className="h-4 w-4" /></span>
                <span className="rounded-full border border-white/15 bg-white/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide">{completedItems.length} pedidos</span>
              </div>
              <div className="mt-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-100">Gasto realizado</p>
                <p className="mt-1 text-2xl font-black tracking-tight">{formatCurrency(totalCost)}</p>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2.5 text-[8px] font-extrabold text-blue-50">
                  <span className="flex items-center gap-1"><ArrowUpRight className="h-3.5 w-3.5" /> Volume do período</span>
                  <span>Realizado</span>
                </div>
              </div>
            </div>
          </article>

          <article className="group relative min-h-[178px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#7134D1] p-4 text-white shadow-xl shadow-violet-950/30 sm:p-5">
            <Receipt className="absolute -right-1 top-7 h-24 w-24 text-white opacity-[0.14] transition-transform duration-500 group-hover:-translate-x-2" strokeWidth={1.5} />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15"><Receipt className="h-4 w-4" /></span>
                <span className="rounded-full border border-white/15 bg-white/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide">{completedItems.length} pedidos</span>
              </div>
              <div className="mt-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-100">Ticket médio</p>
                <p className="mt-1 text-2xl font-black tracking-tight">{formatCurrency(averageTicket)}</p>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2.5 text-[8px] font-extrabold text-violet-50">
                  <span>Valor médio por pedido</span><span>Estável</span>
                </div>
              </div>
            </div>
          </article>

          <article className="group relative min-h-[178px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#C65B02] p-4 text-white shadow-xl shadow-orange-950/30 sm:p-5">
            <Store className="absolute -right-1 top-7 h-24 w-24 text-white opacity-[0.14] transition-transform duration-500 group-hover:-translate-x-2" strokeWidth={1.5} />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15"><Store className="h-4 w-4" /></span>
                <span className="rounded-full border border-white/15 bg-white/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide">Share: {supplierShare}%</span>
              </div>
              <div className="mt-auto min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-orange-100">Top fornecedor</p>
                <p className="mt-1 truncate text-xl font-black tracking-tight" title={topSupplier.name}>{topSupplier.name}</p>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2.5 text-[8px] font-extrabold text-orange-50">
                  <span>Volume alocado</span><span>{formatCurrency(topSupplier.value)}</span>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {operationalIndicators.map(({ label, value, icon: Icon, background, badge, detail }) => (
            <article key={label} className={`group relative min-h-[132px] overflow-hidden rounded-[1.5rem] border border-white/10 p-4 text-white shadow-lg ${background}`}>
              <Icon className="absolute -right-2 top-3 h-24 w-24 text-white opacity-[0.13] transition-transform duration-500 group-hover:-translate-x-1" strokeWidth={1.5} />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15"><Icon className="h-4 w-4" /></span>
                    <p className="text-[8px] font-black uppercase leading-tight tracking-wide">{label}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/20 bg-white/15 px-2 py-1 text-[6px] font-black uppercase">{badge}</span>
                </div>
                <div className="mt-auto flex items-end justify-between gap-3">
                  <p className="text-2xl font-black tracking-tight">{value}</p>
                  <p className="text-right text-[8px] font-extrabold text-white/85">{detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <article className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div><h3 className="text-lg font-black text-slate-900">Evolução do saving</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Economia conquistada por data</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">{formatCurrency(totalSaving)}</span>
          </div>
          <div className="h-72 min-h-[288px] min-w-0 w-full">
            {timelineData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 700 }} tickFormatter={date => new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 12px 30px rgba(15,23,42,.12)', fontSize: 12, fontWeight: 700 }} formatter={(value: number) => [formatCurrency(value), 'Saving']} />
                  <Bar dataKey="saving" fill="#009E68" radius={[8, 8, 2, 2]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-400">Sem dados de saving neste período.</div>}
          </div>
        </article>

        <article className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
          <div className="mb-7"><h3 className="text-lg font-black text-slate-900">Gasto por setor</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Participação no desembolso</p></div>
          <div className="space-y-5">
            {departmentData.slice(0, 5).map((department, index) => {
              const percentage = totalCost > 0 ? Math.round((department.value / totalCost) * 100) : 0;
              return (
                <div key={department.name}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-black text-slate-700"><span className="mr-2 text-slate-300">0{index + 1}</span>{department.name}</span>
                    <span className="shrink-0 font-black text-slate-500">{percentage}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#285BD4]" style={{ width: `${percentage}%` }} /></div>
                  <p className="mt-1.5 text-right text-[10px] font-bold text-slate-400">{formatCurrency(department.value)}</p>
                </div>
              );
            })}
            {!departmentData.length && <div className="rounded-2xl bg-slate-50 py-12 text-center text-sm font-bold text-slate-400">Nenhum gasto realizado.</div>}
          </div>
        </article>
      </section>
    </div>
  );
};
