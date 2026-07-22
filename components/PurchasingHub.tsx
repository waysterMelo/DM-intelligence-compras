import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Clock3, CreditCard, Save, ShoppingCart, Trash2, X } from 'lucide-react';
import { Company, CostTreatment, ItemUseType, Requisition, Status, SupplierQuote } from '../types';
import { PriorityBadge, StatusBadge } from './StatusBadge';

interface PurchasingHubProps {
  requisitions: Requisition[];
  onUpdateStatus: (id: string, status: Status, finalCost?: number, paymentTerms?: string) => Promise<void>;
  onUpdateQuotes: (id: string, quotes: SupplierQuote[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const money = (value?: number | null) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const uses: Array<{ value: ItemUseType; label: string }> = [
  { value: 'INDUSTRIAL_INPUT', label: 'Insumo industrial' },
  { value: 'RESALE', label: 'Revenda' },
  { value: 'FIXED_ASSET', label: 'Ativo' },
  { value: 'CONSUMPTION', label: 'Uso / consumo' },
];
const mainTaxes = [
  { key: 'icms', label: 'ICMS' },
  { key: 'ipi', label: 'IPI' },
  { key: 'pis', label: 'PIS' },
  { key: 'cofins', label: 'Cofins' },
] as const;

const blankQuote = (requisitionId: string, index: number): SupplierQuote => ({
  id: `draft-${requisitionId}-${index}`,
  supplierName: '', price: 0, freight: 0, leadTime: 0, paymentTerms: '', isSelected: false,
  itemUseType: 'INDUSTRIAL_INPUT', ipiTreatment: 'ADDITIONAL', stTreatment: 'ADDITIONAL', fcpTreatment: 'ADDITIONAL', difalTreatment: 'ADDITIONAL',
});

const NumberField = ({ label, value, onChange, suffix }: { label: string; value?: number; onChange: (value?: number) => void; suffix?: string }) => (
  <label className="block min-w-0">
    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    <div className="relative"><input aria-label={label} type="number" min="0" step="0.01" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? undefined : Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />{suffix && <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-slate-400">{suffix}</span>}</div>
  </label>
);

export const PurchasingHub: React.FC<PurchasingHubProps> = ({ requisitions, onUpdateStatus, onUpdateQuotes, onDelete }) => {
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, SupplierQuote[]>>({});
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | 'Pendentes'>('Pendentes');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [negotiatedPrice, setNegotiatedPrice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/companies/suppliers`, { signal: controller.signal }).then(response => response.ok ? response.json() : []).then(setSuppliers).catch(error => {
      if (error?.name !== 'AbortError') setSuppliers([]);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const next: Record<string, SupplierQuote[]> = {};
    requisitions.forEach(requisition => {
      const quotes = (requisition.quotes || []).map(quote => ({ ...quote }));
      while (quotes.length < 3) quotes.push(blankQuote(requisition.id, quotes.length));
      next[requisition.id] = quotes;
    });
    setDrafts(next);
  }, [requisitions]);

  const queue = useMemo(() => requisitions.filter(requisition => requisition.purchaseMode !== 'QUICK' && (
    statusFilter === 'Pendentes' ? ['Solicitado', 'Cotando'].includes(requisition.status) : requisition.status === statusFilter
  )), [requisitions, statusFilter]);
  const selected = requisitions.find(requisition => requisition.id === selectedReqId);
  const quotes = drafts[selectedReqId || ''] || [];
  const active = quotes[activeIndex];
  const comparison = [...(selected?.quotes || [])].sort((a, b) => (a.estimatedNetTotal ?? Number.MAX_SAFE_INTEGER) - (b.estimatedNetTotal ?? Number.MAX_SAFE_INTEGER));
  const mismatched = comparison.length > 1 && new Set(comparison.map(quote => quote.itemUseType)).size > 1;
  const incomplete = comparison.some(quote => quote.dataCompleteness !== 'COMPLETE');
  const winner = quotes.find(quote => quote.isSelected);

  const update = <K extends keyof SupplierQuote>(field: K, value: SupplierQuote[K]) => {
    if (!selectedReqId) return;
    setDrafts(current => {
      const next = [...(current[selectedReqId] || [])];
      const quote = { ...next[activeIndex], [field]: value };
      if (field === 'companyId') quote.supplierName = suppliers.find(company => company.id === value)?.name || '';
      next[activeIndex] = quote;
      return { ...current, [selectedReqId]: next };
    });
  };

  const selectWinner = (index: number) => {
    if (!selectedReqId) return;
    setActiveIndex(index);
    setDrafts(current => ({ ...current, [selectedReqId]: current[selectedReqId].map((quote, quoteIndex) => ({ ...quote, isSelected: quoteIndex === index })) }));
  };

  const saveQuotes = async () => {
    if (!selected) return;
    const valid = quotes.filter(quote => quote.companyId && quote.price >= 0);
    if (!valid.length) return setMessage('Selecione um fornecedor antes de calcular.');
    setSaving(true);
    setMessage(null);
    try {
      await onUpdateQuotes(selected.id, valid);
      setMessage('TCO atualizado. A proposta original foi preservada.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao salvar as propostas.');
    } finally {
      setSaving(false);
    }
  };

  const finishPurchase = async () => {
    if (!selected || !winner) return;
    setSaving(true);
    try {
      await onUpdateQuotes(selected.id, quotes.filter(quote => quote.companyId));
      await onUpdateStatus(selected.id, 'Comprado', Number(negotiatedPrice || winner.price), winner.paymentTerms);
      setShowPurchase(false);
      setSelectedReqId(null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao concluir a compra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px,minmax(0,1fr)]">
      <aside className={`${selected ? 'hidden lg:block' : 'block'} h-fit rounded-[2rem] border border-slate-100 bg-white p-4 shadow-soft`}>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Fila de Compras</h2><p className="text-xs text-slate-400">{queue.length} {queue.length === 1 ? 'item' : 'itens'}</p></div><select aria-label="Filtrar fila por status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as Status | 'Pendentes')} className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold"><option>Pendentes</option><option>Solicitado</option><option>Cotando</option><option>Aprovado</option><option>Comprado</option></select></div>
        <div className="space-y-2">{queue.map(requisition => <button key={requisition.id} onClick={() => { setSelectedReqId(requisition.id); setActiveIndex(0); setMessage(null); }} className={`w-full rounded-2xl border p-4 text-left transition ${selectedReqId === requisition.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}><div className="flex justify-between gap-2"><span className="line-clamp-2 text-sm font-black text-slate-800">{requisition.name}</span><PriorityBadge priority={requisition.priority} /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{requisition.quantity} {requisition.unit}</span><StatusBadge status={requisition.status} /></div></button>)}{!queue.length && <p className="py-10 text-center text-sm text-slate-400">Nenhum item nesta fila.</p>}</div>
      </aside>

      {!selected ? <section className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center"><div><ShoppingCart className="mx-auto mb-3 h-11 w-11 text-slate-200" /><h2 className="font-black text-slate-700">Selecione uma requisição</h2><p className="text-sm text-slate-400">Cadastre propostas e compare o custo total.</p></div></section> : (
        <section className="min-w-0 space-y-4">
          <header className="flex items-start justify-between gap-4 rounded-[2rem] border border-slate-100 bg-white p-5">
            <div className="flex min-w-0 items-start gap-3"><button onClick={() => setSelectedReqId(null)} className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600 lg:hidden" aria-label="Voltar à fila"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Simulador de TCO</p><h2 className="truncate text-xl font-black text-slate-900 sm:text-2xl">{selected.name}</h2><p className="text-sm text-slate-500">{selected.quantity} {selected.unit} · {selected.department}</p></div></div>
            <button onClick={() => onDelete(selected.id)} className="rounded-xl p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Excluir requisição"><Trash2 className="h-5 w-5" /></button>
          </header>

          {comparison.length > 0 && <section className="rounded-[2rem] border border-slate-100 bg-white p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-800">Comparação de fornecedores</h3><p className="text-xs text-slate-400">Menor TCO primeiro. A escolha continua sendo sua.</p></div>{(mismatched || incomplete) && <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"><AlertTriangle className="h-4 w-4" />Revise as condições</span>}</div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{comparison.map((quote, rank) => {
              const memory = quote.tcoMemory as any;
              const taxes = ['icms', 'ipi', 'pis', 'cofins', 'st', 'fcp', 'difal'].reduce((sum, tax) => sum + Number(memory?.resolvedTaxes?.[tax]?.amount || 0), 0) * selected.quantity;
              const draftIndex = quotes.findIndex(draft => draft.companyId === quote.companyId);
              return <article key={quote.id} className={`rounded-2xl border p-4 ${quote.isSelected ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">#{rank + 1} por TCO</p><h4 className="font-black text-slate-900">{quote.supplierName}</h4></div>{quote.dataCompleteness === 'COMPLETE' ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700"><CheckCircle2 className="h-4 w-4" />Completa</span> : <span className="text-[10px] font-black text-amber-700">Incompleta</span>}</div><div className="my-4"><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">TCO estimado</p><p className="text-2xl font-black text-blue-700">{money(quote.estimatedNetTotal)}</p></div><div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-400">Custo bruto</span><p className="font-black">{money(quote.grossTotalCost)}</p></div><div><span className="text-slate-400">Recuperação</span><p className="font-black text-emerald-600">{money(quote.estimatedCreditTotal)}</p></div><div><span className="text-slate-400">Preço / frete</span><p className="font-black">{money(quote.price)} · {money(quote.freight)}</p></div><div><span className="text-slate-400">Tributos</span><p className="font-black">{money(taxes)}</p></div></div><div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500"><span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1"><Clock3 className="h-3 w-3" />{quote.leadTime || 0} dias</span><span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1"><CreditCard className="h-3 w-3" />{quote.paymentTerms || 'Pagamento não informado'}</span></div>{quote.isSelected ? <p className="mt-4 text-xs font-black text-emerald-700">Fornecedor escolhido</p> : draftIndex >= 0 && <button onClick={() => selectWinner(draftIndex)} className="mt-4 text-xs font-black text-blue-700">Escolher este fornecedor</button>}</article>;
            })}</div>
          </section>}

          <section className="rounded-[2rem] border border-slate-100 bg-white p-4 sm:p-5">
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{quotes.map((quote, index) => <button key={quote.id} onClick={() => setActiveIndex(index)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black ${activeIndex === index ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Proposta {index + 1}{quote.isSelected ? ' · escolhida' : ''}</button>)}</div>
            {active && <div className="space-y-5">
              <div><h3 className="font-black text-slate-900">Dados principais</h3><p className="text-xs text-slate-400">O necessário para comparar preço, prazo e pagamento.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Fornecedor</span><select aria-label="Fornecedor" value={active.companyId || ''} onChange={event => update('companyId', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500"><option value="">Selecione</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                <NumberField label="Preço unitário" value={active.price} onChange={value => update('price', value || 0)} />
                <NumberField label="Frete total" value={active.freight} onChange={value => update('freight', value)} />
                <NumberField label="Prazo" value={active.leadTime} onChange={value => update('leadTime', value)} suffix="dias" />
                <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Pagamento</span><input aria-label="Pagamento" value={active.paymentTerms || ''} onChange={event => update('paymentTerms', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Destinação</span><select aria-label="Destinação" value={active.itemUseType} onChange={event => update('itemUseType', event.target.value as ItemUseType)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold">{uses.map(use => <option key={use.value} value={use.value}>{use.label}</option>)}</select></label>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4"><div className="mb-4"><h3 className="font-black text-slate-900">Tributos da proposta</h3><p className="text-xs text-slate-400">Use o valor monetário quando estiver disponível; ele prevalece sobre a alíquota.</p></div><div className="space-y-3">{mainTaxes.map(tax => <div key={tax.key} className="grid grid-cols-[64px,minmax(0,1fr),minmax(0,1fr)] items-end gap-2 sm:grid-cols-[90px,180px,180px]"><p className="pb-2.5 text-sm font-black text-slate-800">{tax.label}</p><NumberField label={`${tax.label} alíquota`} value={active[`${tax.key}Rate` as keyof SupplierQuote] as number | undefined} onChange={value => update(`${tax.key}Rate` as keyof SupplierQuote, value as never)} suffix="%" /><NumberField label={`${tax.label} valor unitário`} value={active[`${tax.key}Value` as keyof SupplierQuote] as number | undefined} onChange={value => update(`${tax.key}Value` as keyof SupplierQuote, value as never)} /></div>)}</div></div>

              <details className="group rounded-2xl border border-slate-200 bg-slate-50/60"><summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-black text-slate-700">Dados opcionais e tributos adicionais <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><div className="space-y-5 border-t border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">NCM</span><input aria-label="NCM opcional" value={active.ncm || ''} onChange={event => update('ncm', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold" /></label>{([['CEST', 'cest'], ['CFOP', 'cfop'], ['CST ICMS', 'cstIcms']] as const).map(([label, key]) => <label key={key}><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><input aria-label={`${label} referência`} value={active[key] || ''} onChange={event => update(key, event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold" /></label>)}</div>
                <label className="block max-w-sm"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Tratamento do IPI</span><select aria-label="Tratamento do IPI" value={active.ipiTreatment || 'ADDITIONAL'} onChange={event => update('ipiTreatment', event.target.value as CostTreatment)} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-bold"><option value="ADDITIONAL">Adicional ao preço</option><option value="INCLUDED">Já incluído no preço</option></select></label>
                <div className="grid gap-3 md:grid-cols-3">{([
                  { label: 'ICMS-ST', flag: 'hasIcmsSt', value: 'stValue', rate: 'stRate', treatment: 'stTreatment' },
                  { label: 'FCP', flag: 'hasFcp', value: 'fcpValue', rate: 'fcpRate', treatment: 'fcpTreatment' },
                  { label: 'DIFAL', flag: 'hasDifal', value: 'difalValue', rate: 'difalRate', treatment: 'difalTreatment' },
                ] as const).map(tax => <div key={tax.label} className="rounded-2xl border border-slate-200 bg-white p-4"><label className="mb-3 flex items-center justify-between text-sm font-black"><span>Aplicar {tax.label}</span><input aria-label={`Aplicar ${tax.label}`} type="checkbox" checked={Boolean(active[tax.flag])} onChange={event => update(tax.flag, event.target.checked)} /></label><div className="grid grid-cols-2 gap-2"><NumberField label={`${tax.label} alíquota`} value={active[tax.rate]} onChange={value => update(tax.rate, value)} suffix="%" /><NumberField label={`${tax.label} valor unitário`} value={active[tax.value]} onChange={value => update(tax.value, value)} /></div><select aria-label={`Tratamento do ${tax.label}`} value={active[tax.treatment] || 'ADDITIONAL'} onChange={event => update(tax.treatment, event.target.value as CostTreatment)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold"><option value="ADDITIONAL">Adicional ao preço</option><option value="INCLUDED">Já incluído no preço</option></select></div>)}</div>
                <div className="rounded-2xl bg-violet-50 p-4"><p className="mb-3 text-xs font-bold text-violet-700">Ajuste opcional da premissa comercial (%)</p><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{(['Icms', 'Ipi', 'Pis', 'Cofins'] as const).map(tax => <div key={tax}><NumberField label={tax} value={active[`utilization${tax}`]} onChange={value => update(`utilization${tax}`, value)} suffix="%" /></div>)}</div></div>
              </div></details>

              {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800">{message}</p>}
              <div className="sticky bottom-20 z-20 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-2"><button onClick={() => selectWinner(activeIndex)} className={`rounded-xl px-4 py-3 text-xs font-black ${active.isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active.isSelected ? 'Fornecedor escolhido' : 'Escolher esta proposta'}</button><div className="flex gap-2"><button disabled={saving} onClick={saveQuotes} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50 sm:flex-none"><Save className="mr-2 inline h-4 w-4" />Salvar e calcular</button><button disabled={!winner || saving} onClick={() => { setNegotiatedPrice(String(winner?.price || '')); setShowPurchase(true); }} className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40 sm:flex-none">Concluir compra</button></div></div>
            </div>}
          </section>
        </section>
      )}

      {showPurchase && selected && winner && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-title"><div className="w-full max-w-md rounded-[2rem] bg-white p-6"><div className="flex justify-between gap-4"><div><h3 id="purchase-title" className="text-xl font-black">Confirmar compra</h3><p className="text-sm text-slate-400">A proposta original não será alterada.</p></div><button onClick={() => setShowPurchase(false)} aria-label="Fechar"><X className="h-5 w-5" /></button></div><div className="mt-6"><NumberField label="Valor unitário negociado" value={Number(negotiatedPrice)} onChange={value => setNegotiatedPrice(String(value ?? ''))} /><p className="mt-3 text-xs text-slate-500">Saving: <strong className="text-emerald-700">{money(Math.max(0, winner.price - Number(negotiatedPrice || winner.price)) * selected.quantity)}</strong></p></div><div className="mt-6 flex gap-3"><button onClick={() => setShowPurchase(false)} className="flex-1 rounded-xl bg-slate-100 p-3 text-xs font-bold">Cancelar</button><button onClick={finishPurchase} disabled={saving} className="flex-1 rounded-xl bg-blue-600 p-3 text-xs font-bold text-white">Confirmar</button></div></div></div>}
    </div>
  );
};
