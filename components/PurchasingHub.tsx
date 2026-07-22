import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, Save, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
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

const blankQuote = (reqId: string, index: number): SupplierQuote => ({
  id: `draft-${reqId}-${index}`,
  supplierName: '',
  price: 0,
  freight: 0,
  leadTime: 0,
  paymentTerms: '',
  isSelected: false,
  itemUseType: 'INDUSTRIAL_INPUT',
  ipiTreatment: 'ADDITIONAL',
  stTreatment: 'ADDITIONAL',
  fcpTreatment: 'ADDITIONAL',
  difalTreatment: 'ADDITIONAL',
});

const NumberField = ({ label, value, onChange, suffix }: { label: string; value?: number; onChange: (value?: number) => void; suffix?: string }) => (
  <label className="block">
    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</span>
    <div className="relative">
      <input type="number" min="0" step="0.01" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? undefined : Number(event.target.value))} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
      {suffix && <span className="absolute right-3 top-2 text-xs text-slate-400">{suffix}</span>}
    </div>
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
    fetch(`${API_BASE_URL}/companies/suppliers`).then(response => response.ok ? response.json() : []).then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    const next: Record<string, SupplierQuote[]> = {};
    requisitions.forEach(req => {
      const quotes = (req.quotes || []).map(quote => ({ ...quote }));
      while (quotes.length < 3) quotes.push(blankQuote(req.id, quotes.length));
      next[req.id] = quotes;
    });
    setDrafts(next);
  }, [requisitions]);

  const queue = useMemo(() => requisitions.filter(req => req.purchaseMode !== 'QUICK' && (
    statusFilter === 'Pendentes' ? ['Solicitado', 'Cotando'].includes(req.status) : req.status === statusFilter
  )), [requisitions, statusFilter]);
  const selected = requisitions.find(req => req.id === selectedReqId);
  const quotes = drafts[selectedReqId || ''] || [];
  const active = quotes[activeIndex];
  const persistedQuotes = selected?.quotes || [];
  const comparison = [...persistedQuotes].sort((a, b) => (a.estimatedNetTotal ?? Number.MAX_SAFE_INTEGER) - (b.estimatedNetTotal ?? Number.MAX_SAFE_INTEGER));
  const mismatched = comparison.length > 1 && new Set(comparison.map(quote => quote.itemUseType)).size > 1;
  const incomplete = comparison.some(quote => quote.dataCompleteness !== 'COMPLETE');
  const winner = quotes.find(quote => quote.isSelected);

  const update = <K extends keyof SupplierQuote>(field: K, value: SupplierQuote[K]) => {
    if (!selectedReqId) return;
    setDrafts(current => {
      const next = [...(current[selectedReqId] || [])];
      const quote = { ...next[activeIndex], [field]: value };
      if (field === 'companyId') quote.supplierName = suppliers.find(item => item.id === value)?.name || '';
      next[activeIndex] = quote;
      return { ...current, [selectedReqId]: next };
    });
  };

  const selectWinner = (index: number) => {
    if (!selectedReqId) return;
    setDrafts(current => ({
      ...current,
      [selectedReqId]: current[selectedReqId].map((quote, quoteIndex) => ({ ...quote, isSelected: quoteIndex === index })),
    }));
  };

  const saveQuotes = async () => {
    if (!selected) return;
    const valid = quotes.filter(quote => quote.companyId && quote.price >= 0);
    if (!valid.length) return setMessage('Cadastre ao menos uma cotação com fornecedor.');
    setSaving(true);
    setMessage(null);
    try {
      await onUpdateQuotes(selected.id, valid);
      setMessage('Cotações calculadas e salvas pelo Simulador de TCO.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao salvar as cotações.');
    } finally {
      setSaving(false);
    }
  };

  const finishPurchase = async () => {
    if (!selected || !winner) return;
    const finalUnitPrice = Number(negotiatedPrice || winner.price);
    setSaving(true);
    try {
      await onUpdateQuotes(selected.id, quotes.filter(quote => quote.companyId));
      await onUpdateStatus(selected.id, 'Comprado', finalUnitPrice, winner.paymentTerms);
      setShowPurchase(false);
      setSelectedReqId(null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao concluir a compra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-6 pb-12">
      <aside className="bg-white rounded-[2rem] border border-slate-100 shadow-soft p-5 h-fit">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="font-black text-slate-900">Fila de Compras</h2><p className="text-xs text-slate-400">{queue.length} itens</p></div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as Status | 'Pendentes')} className="rounded-xl bg-slate-50 p-2 text-xs font-bold">
            <option>Pendentes</option><option>Solicitado</option><option>Cotando</option><option>Aprovado</option><option>Comprado</option>
          </select>
        </div>
        <div className="space-y-3">
          {queue.map(req => (
            <button key={req.id} onClick={() => { setSelectedReqId(req.id); setActiveIndex(0); setMessage(null); }} className={`w-full text-left rounded-2xl border p-4 transition ${selectedReqId === req.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
              <div className="flex justify-between gap-2"><span className="font-black text-sm text-slate-800 line-clamp-2">{req.name}</span><PriorityBadge priority={req.priority} /></div>
              <div className="mt-3 flex justify-between items-center text-xs text-slate-500"><span>{req.quantity} {req.unit}</span><StatusBadge status={req.status} /></div>
            </button>
          ))}
          {!queue.length && <p className="text-center py-12 text-sm text-slate-400">Nenhum item nesta fila.</p>}
        </div>
      </aside>

      {!selected ? (
        <section className="bg-white rounded-[2rem] border border-dashed border-slate-200 min-h-[560px] flex items-center justify-center text-center p-8">
          <div><ShoppingCart className="w-12 h-12 mx-auto text-slate-200 mb-3" /><h2 className="font-black text-slate-700">Selecione uma requisição</h2><p className="text-sm text-slate-400">Cadastre as propostas e compare pelo TCO estimado.</p></div>
        </section>
      ) : (
        <section className="space-y-5 min-w-0">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-wrap justify-between gap-4">
            <div><p className="text-xs uppercase tracking-widest font-bold text-blue-600">Simulador de TCO</p><h2 className="text-2xl font-black text-slate-900 mt-1">{selected.name}</h2><p className="text-sm text-slate-500">{selected.quantity} {selected.unit} · {selected.department}</p></div>
            <button onClick={() => onDelete(selected.id)} className="self-start p-3 rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Excluir"><Trash2 className="w-5 h-5" /></button>
          </div>

          {comparison.length > 0 && (
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between gap-3"><div><h3 className="font-black text-slate-800">Comparação de fornecedores</h3><p className="text-xs text-slate-400">Ordenação inicial pelo menor TCO; a decisão permanece com o comprador.</p></div>{(mismatched || incomplete) && <span className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-xl"><AlertTriangle className="w-4 h-4" />Condições não totalmente comparáveis</span>}</div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3 text-left">Fornecedor</th><th className="p-3 text-right">Preço / frete</th><th className="p-3 text-right">Tributos informados</th><th className="p-3 text-right">Custo bruto</th><th className="p-3 text-right">Recuperação estimada</th><th className="p-3 text-right">TCO estimado</th><th className="p-3 text-left">Prazo / pagamento</th><th className="p-3">Dados</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{comparison.map(quote => {
                  const memory = quote.tcoMemory as any;
                  const informedTaxes = ['icms', 'ipi', 'pis', 'cofins', 'st', 'fcp', 'difal'].reduce((sum, tax) => sum + Number(memory?.resolvedTaxes?.[tax]?.amount || 0), 0) * selected.quantity;
                  return <tr key={quote.id} className={quote.isSelected ? 'bg-emerald-50/50' : ''}><td className="p-3 font-bold">{quote.supplierName}</td><td className="p-3 text-right"><p>{money(quote.price)} / un.</p><p className="text-xs text-slate-400"><Truck className="w-3 h-3 inline mr-1" />{money(quote.freight)}</p></td><td className="p-3 text-right">{money(informedTaxes)}</td><td className="p-3 text-right">{money(quote.grossTotalCost)}</td><td className="p-3 text-right text-emerald-600">{money(quote.estimatedCreditTotal)}</td><td className="p-3 text-right font-black text-blue-700">{money(quote.estimatedNetTotal)}</td><td className="p-3"><div className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{quote.leadTime || 0} dias</div><div className="flex items-center gap-1 text-xs text-slate-400"><CreditCard className="w-3 h-3" />{quote.paymentTerms || 'Não informado'}</div></td><td className="p-3 text-center">{quote.dataCompleteness === 'COMPLETE' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 inline" /> : <span className="text-[10px] font-black text-amber-700">INCOMPLETA</span>}</td></tr>;
                })}</tbody></table></div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] border border-slate-100 p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {quotes.map((quote, index) => <button key={quote.id} onClick={() => setActiveIndex(index)} className={`px-4 py-2 rounded-xl text-xs font-black ${activeIndex === index ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Fornecedor {index + 1}{quote.isSelected ? ' · escolhido' : ''}</button>)}
            </div>
            {active && <div className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="lg:col-span-2"><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Fornecedor</span><select value={active.companyId || ''} onChange={event => update('companyId', event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold"><option value="">Selecione</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                <NumberField label="Preço unitário" value={active.price} onChange={value => update('price', value || 0)} />
                <NumberField label="Frete total" value={active.freight} onChange={value => update('freight', value)} />
                <NumberField label="Prazo" value={active.leadTime} onChange={value => update('leadTime', value)} suffix="dias" />
                <label><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Pagamento</span><input value={active.paymentTerms || ''} onChange={event => update('paymentTerms', event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold" /></label>
                <label><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Destinação</span><select value={active.itemUseType} onChange={event => update('itemUseType', event.target.value as ItemUseType)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">{uses.map(use => <option key={use.value} value={use.value}>{use.label}</option>)}</select></label>
                <label><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">NCM opcional</span><input value={active.ncm || ''} onChange={event => update('ncm', event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold" /></label>
              </div>

              <div><h4 className="font-black text-slate-800">Tributos informados pelo fornecedor</h4><p className="text-xs text-slate-400 mt-1">Informe o valor monetário sempre que disponível; ele prevalece sobre a alíquota.</p></div>
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[['ICMS', 'icms'], ['IPI', 'ipi'], ['PIS', 'pis'], ['Cofins', 'cofins']].map(([label, key]) => <div key={key} className="p-4 rounded-2xl border border-slate-100"><p className="font-black text-sm mb-3">{label}</p><div className="grid grid-cols-2 gap-2"><NumberField label="Alíquota" value={active[`${key}Rate` as keyof SupplierQuote] as number | undefined} onChange={value => update(`${key}Rate` as keyof SupplierQuote, value as never)} suffix="%" /><NumberField label="Valor unit." value={active[`${key}Value` as keyof SupplierQuote] as number | undefined} onChange={value => update(`${key}Value` as keyof SupplierQuote, value as never)} /></div></div>)}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <label><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">CEST (referência)</span><input value={active.cest || ''} onChange={event => update('cest', event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold" /></label>
                <label><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">CFOP (referência)</span><input value={active.cfop || ''} onChange={event => update('cfop', event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold" /></label>
                <label><span className="block text-[10px] font-black uppercase text-slate-400 mb-1">CST ICMS (referência)</span><input value={active.cstIcms || ''} onChange={event => update('cstIcms', event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold" /></label>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {([
                  { label: 'IPI', flag: null, value: 'ipiValue', rate: 'ipiRate', treatment: 'ipiTreatment' },
                  { label: 'ICMS-ST', flag: 'hasIcmsSt', value: 'stValue', rate: 'stRate', treatment: 'stTreatment' },
                  { label: 'FCP', flag: 'hasFcp', value: 'fcpValue', rate: 'fcpRate', treatment: 'fcpTreatment' },
                  { label: 'DIFAL', flag: 'hasDifal', value: 'difalValue', rate: 'difalRate', treatment: 'difalTreatment' },
                ] as const).map(tax => <div key={tax.label} className="p-4 rounded-2xl bg-slate-50"><div className="flex items-center justify-between mb-3"><span className="font-black text-sm">{tax.label}</span>{tax.flag && <input type="checkbox" checked={Boolean(active[tax.flag])} onChange={event => update(tax.flag, event.target.checked)} />}</div><div className="grid grid-cols-2 gap-2"><NumberField label="Alíquota" value={active[tax.rate]} onChange={value => update(tax.rate, value)} suffix="%" /><NumberField label="Valor unit." value={active[tax.value]} onChange={value => update(tax.value, value)} /></div><select value={active[tax.treatment] || 'ADDITIONAL'} onChange={event => update(tax.treatment, event.target.value as CostTreatment)} className="w-full rounded-xl bg-white p-2 mt-3 text-xs font-bold"><option value="ADDITIONAL">Adicional ao preço</option><option value="INCLUDED">Já incluído no preço</option></select></div>)}
              </div>

              <div className="grid md:grid-cols-4 gap-3 p-4 bg-violet-50 rounded-2xl"><p className="md:col-span-4 text-xs font-bold text-violet-700">Ajuste opcional por cotação — premissa comercial (%)</p>{(['Icms', 'Ipi', 'Pis', 'Cofins'] as const).map(tax => <div key={tax}><NumberField label={tax} value={active[`utilization${tax}`]} onChange={value => update(`utilization${tax}`, value)} suffix="%" /></div>)}</div>

              <div className="flex flex-wrap justify-between gap-3 pt-2"><button onClick={() => selectWinner(activeIndex)} className={`px-5 py-3 rounded-xl text-xs font-black ${active.isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active.isSelected ? 'Fornecedor escolhido' : 'Escolher este fornecedor'}</button><div className="flex gap-3"><button disabled={saving} onClick={saveQuotes} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" />Salvar e calcular</button><button disabled={!winner || saving} onClick={() => { setNegotiatedPrice(String(winner?.price || '')); setShowPurchase(true); }} className="px-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-40">Concluir compra</button></div></div>
              {message && <p className="text-sm font-bold text-blue-700 bg-blue-50 p-3 rounded-xl">{message}</p>}
            </div>}
          </div>
        </section>
      )}

      {showPurchase && selected && winner && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] p-7 max-w-md w-full"><div className="flex justify-between"><div><h3 className="text-xl font-black">Confirmar compra</h3><p className="text-sm text-slate-400">A cotação original será preservada.</p></div><button onClick={() => setShowPurchase(false)}><X className="w-5 h-5" /></button></div><div className="mt-6"><NumberField label="Valor unitário negociado" value={Number(negotiatedPrice)} onChange={value => setNegotiatedPrice(String(value ?? ''))} /><p className="mt-3 text-xs text-slate-500">Saving: {money(Math.max(0, winner.price - Number(negotiatedPrice || winner.price)) * selected.quantity)}</p></div><div className="mt-6 flex gap-3"><button onClick={() => setShowPurchase(false)} className="flex-1 p-3 bg-slate-100 rounded-xl font-bold text-xs">Cancelar</button><button onClick={finishPurchase} disabled={saving} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold text-xs">Confirmar</button></div></div></div>}
    </div>
  );
};
