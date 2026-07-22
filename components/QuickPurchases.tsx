import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, FileCode2, Plus, Receipt, Upload, X, Zap } from 'lucide-react';
import { Company, CostReconciliationStatus, Department, ManualInvoiceInput, QuickPurchaseInput, Requisition } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const departments: Department[] = ['Produção', 'Ferramentaria', 'Manutenção', 'Escritório', 'Logística'];
const money = (value?: number | null) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const number = (value: string) => Number(value.replace(',', '.')) || 0;
const taxFields = [['ICMS', 'icmsTotal'], ['IPI', 'ipiTotal'], ['PIS', 'pisTotal'], ['Cofins', 'cofinsTotal'], ['ICMS-ST', 'stTotal'], ['FCP', 'fcpTotal'], ['DIFAL', 'difalTotal']] as const;

interface QuickPurchasesProps {
  requisitions: Requisition[];
  onCreate: (data: QuickPurchaseInput) => Promise<void>;
  onManualInvoice: (id: string, data: ManualInvoiceInput) => Promise<void>;
  onXmlInvoice: (id: string, file: File) => Promise<void>;
  onReconcile: (id: string, acceptDivergence?: boolean) => Promise<void>;
  defaultRequester?: string;
}

const statusLabels: Record<CostReconciliationStatus, string> = {
  NOT_REQUIRED: 'Não aplicável', PENDING_INVOICE: 'Aguardando NF', INVOICE_RECEIVED: 'NF recebida', COST_CONFIRMED: 'Custo conferido', DIVERGENCE_FOUND: 'Divergência encontrada',
};

const Field = ({ label, value, onChange, type = 'text', required = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; readOnly?: boolean }) => (
  <label className="block min-w-0"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><input aria-label={label} required={required} readOnly={readOnly} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} value={value} onChange={event => onChange(event.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${readOnly ? 'border-slate-100 bg-slate-100 text-slate-500' : 'border-slate-200 bg-white'}`} /></label>
);

export const QuickPurchases: React.FC<QuickPurchasesProps> = ({ requisitions, onCreate, onManualInvoice, onXmlInvoice, onReconcile, defaultRequester = '' }) => {
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', quantity: '1', unit: 'un', unitPrice: '', freight: '', supplierId: '', department: 'Produção' as Department, requester: defaultRequester, paymentTerms: '', notes: '' });
  const [invoice, setInvoice] = useState({ number: '', series: '', accessKey: '', issueDate: new Date().toISOString().slice(0, 10), supplierCnpj: '', productTotal: '', freightTotal: '', discountTotal: '', grossTotal: '', icmsTotal: '', ipiTotal: '', pisTotal: '', cofinsTotal: '', stTotal: '', fcpTotal: '', difalTotal: '' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/companies/suppliers`, { signal: controller.signal }).then(response => response.ok ? response.json() : []).then(setSuppliers).catch(error => {
      if (error?.name !== 'AbortError') setSuppliers([]);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (defaultRequester) setForm(current => current.requester ? current : { ...current, requester: defaultRequester });
  }, [defaultRequester]);

  const purchases = useMemo(() => requisitions.filter(item => ['Comprado', 'Entregue'].includes(item.status)), [requisitions]);
  const pendingCount = purchases.filter(item => item.costReconciliationStatus === 'PENDING_INVOICE').length;

  const createPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onCreate({ name: form.name, quantity: number(form.quantity), unit: form.unit, unitPrice: number(form.unitPrice), freight: number(form.freight), supplierId: form.supplierId, department: form.department, requester: form.requester, paymentTerms: form.paymentTerms, notes: form.notes });
      setForm(current => ({ ...current, name: '', quantity: '1', unitPrice: '', freight: '', notes: '' }));
      setMessage('Compra registrada e adicionada à fila de notas.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao registrar a compra.');
    } finally {
      setSaving(false);
    }
  };

  const openInvoice = (purchase: Requisition) => {
    const winner = purchase.quotes.find(quote => quote.isSelected) || purchase.quotes[0];
    const quotedGross = winner?.grossTotalCost ?? ((winner?.price || 0) * purchase.quantity + (winner?.freight || 0));
    setSelected(purchase);
    setXmlFile(null);
    setInvoice({ number: '', series: '', accessKey: '', issueDate: new Date().toISOString().slice(0, 10), supplierCnpj: winner?.company?.cnpj || '', productTotal: String((winner?.price || 0) * purchase.quantity), freightTotal: String(winner?.freight || 0), discountTotal: '0', grossTotal: String(quotedGross), icmsTotal: '', ipiTotal: '', pisTotal: '', cofinsTotal: '', stTotal: '', fcpTotal: '', difalTotal: '' });
  };

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      await onManualInvoice(selected.id, { number: invoice.number, series: invoice.series, accessKey: invoice.accessKey.replace(/\D/g, ''), issueDate: invoice.issueDate, supplierCnpj: invoice.supplierCnpj.replace(/\D/g, ''), productTotal: number(invoice.productTotal), freightTotal: number(invoice.freightTotal), discountTotal: number(invoice.discountTotal), grossTotal: number(invoice.grossTotal), icmsTotal: number(invoice.icmsTotal), ipiTotal: number(invoice.ipiTotal), pisTotal: number(invoice.pisTotal), cofinsTotal: number(invoice.cofinsTotal), stTotal: number(invoice.stTotal), fcpTotal: number(invoice.fcpTotal), difalTotal: number(invoice.difalTotal) });
      setSelected(null);
      setMessage('NF registrada e comparada com a proposta.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao registrar a NF.');
    } finally {
      setSaving(false);
    }
  };

  const submitXml = async () => {
    if (!selected || !xmlFile) return;
    setSaving(true);
    setMessage(null);
    try {
      await onXmlInvoice(selected.id, xmlFile);
      setSelected(null);
      setMessage('XML importado e comparado com a proposta.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao importar XML.');
    } finally {
      setSaving(false);
    }
  };

  const confirmCost = async (purchase: Requisition) => {
    setSaving(true);
    try {
      await onReconcile(purchase.id, purchase.costReconciliationStatus === 'DIVERGENCE_FOUND');
      setMessage('Conferência de custo confirmada.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao confirmar a conferência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="grid gap-5 xl:grid-cols-[380px,minmax(0,1fr)]">
        <form onSubmit={createPurchase} className="h-fit rounded-[2rem] border border-slate-100 bg-white p-5 shadow-soft">
          <div className="mb-5 flex gap-3"><div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Zap className="h-5 w-5" /></div><div><h2 className="text-xl font-black">Nova compra rápida</h2><p className="text-xs text-slate-400">Registre agora; confira a NF depois.</p></div></div>
          <div className="space-y-3"><Field label="Item" value={form.name} onChange={name => setForm(current => ({ ...current, name }))} required /><div className="grid grid-cols-3 gap-2"><Field label="Quantidade" type="number" value={form.quantity} onChange={quantity => setForm(current => ({ ...current, quantity }))} required /><Field label="Unidade" value={form.unit} onChange={unit => setForm(current => ({ ...current, unit }))} required /><Field label="Preço unit." type="number" value={form.unitPrice} onChange={unitPrice => setForm(current => ({ ...current, unitPrice }))} required /></div><Field label="Frete total" type="number" value={form.freight} onChange={freight => setForm(current => ({ ...current, freight }))} />
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Fornecedor</span><select aria-label="Fornecedor" required value={form.supplierId} onChange={event => setForm(current => ({ ...current, supplierId: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"><option value="">Selecione</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2"><label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Departamento</span><select aria-label="Departamento" value={form.department} onChange={event => setForm(current => ({ ...current, department: event.target.value as Department }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold">{departments.map(department => <option key={department}>{department}</option>)}</select></label><Field label="Comprador" value={form.requester} onChange={requester => setForm(current => ({ ...current, requester }))} /></div><Field label="Condição de pagamento" value={form.paymentTerms} onChange={paymentTerms => setForm(current => ({ ...current, paymentTerms }))} />
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" />Registrar compra</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-soft"><div className="flex justify-between border-b border-slate-100 p-5"><div><h2 className="text-xl font-black">Conferência de notas</h2><p className="text-xs text-slate-400">{pendingCount} {pendingCount === 1 ? 'compra aguardando' : 'compras aguardando'} NF</p></div><Receipt className="h-6 w-6 text-blue-500" /></div><div className="divide-y divide-slate-100">{purchases.map(purchase => {
          const status = purchase.costReconciliationStatus || 'PENDING_INVOICE';
          const invoiceData = purchase.purchaseInvoice;
          return <article key={purchase.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black text-slate-800">{purchase.name}</h3><p className="text-xs text-slate-400">{purchase.quantity} {purchase.unit} · {purchase.quotes.find(quote => quote.isSelected)?.supplierName || purchase.quotes[0]?.supplierName}</p></div><span className={`h-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${status === 'DIVERGENCE_FOUND' ? 'bg-rose-100 text-rose-700' : status === 'COST_CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : status === 'INVOICE_RECEIVED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabels[status]}</span></div>
            {invoiceData && <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 xl:grid-cols-6">{[
              ['Cotado bruto', invoiceData.quotedGrossTotal], ['NF', invoiceData.grossTotal], ['Dif. frete', invoiceData.freightVariance], ['Dif. tributos', invoiceData.taxVariance], ['TCO realizado', invoiceData.actualNetEstimatedTotal], ['Dif. TCO', invoiceData.netVariance],
            ].map(([label, value]) => <div key={String(label)}><span className="text-slate-400">{label}</span><p className={`font-black ${label === 'Dif. TCO' && Math.abs(Number(value)) > 0.01 ? 'text-rose-600' : ''}`}>{money(Number(value))}</p></div>)}</div>}
            <div className="mt-4 flex flex-wrap gap-2">{status === 'PENDING_INVOICE' && <button onClick={() => openInvoice(purchase)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white"><Upload className="h-4 w-4" />Receber NF</button>}{status === 'INVOICE_RECEIVED' && <button disabled={saving} onClick={() => confirmCost(purchase)} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4" />Confirmar custo</button>}{status === 'DIVERGENCE_FOUND' && <button disabled={saving} onClick={() => confirmCost(purchase)} className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white"><AlertTriangle className="h-4 w-4" />Aceitar divergência e confirmar</button>}</div>
          </article>;
        })}{!purchases.length && <div className="p-14 text-center text-sm text-slate-400"><Clock3 className="mx-auto mb-3 h-10 w-10 text-slate-200" />Nenhuma compra concluída.</div>}</div></section>
      </div>
      {message && <div role="status" className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>}

      {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-title"><div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><h3 id="invoice-title" className="text-xl font-black">Receber NF — {selected.name}</h3><p className="text-xs text-slate-400">A proposta será mantida e comparada com o realizado.</p></div><button onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-500" aria-label="Fechar"><X className="h-5 w-5" /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="flex gap-3"><FileCode2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div className="min-w-0 flex-1"><p className="font-black text-blue-900">Importar XML da NF-e 4.0</p><p className="mb-3 text-xs text-blue-700">É o caminho mais rápido e reduz digitação.</p><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="cursor-pointer rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700"><span>{xmlFile?.name || 'Escolher arquivo XML'}</span><input aria-label="Arquivo XML da NF-e" type="file" accept=".xml,text/xml,application/xml" onChange={event => setXmlFile(event.target.files?.[0] || null)} className="sr-only" /></label><button type="button" disabled={!xmlFile || saving} onClick={submitXml} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Importar e comparar</button></div></div></div></div>
          <div className="mb-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-black uppercase text-slate-400">ou preencher manualmente</span><div className="h-px flex-1 bg-slate-200" /></div>
          <form id="manual-invoice-form" onSubmit={submitManual} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Número" value={invoice.number} onChange={value => setInvoice(current => ({ ...current, number: value }))} required /><Field label="Série" value={invoice.series} onChange={value => setInvoice(current => ({ ...current, series: value }))} /><Field label="Data de emissão" type="date" value={invoice.issueDate} onChange={value => setInvoice(current => ({ ...current, issueDate: value }))} required /><Field label="CNPJ fornecedor" value={invoice.supplierCnpj} onChange={() => undefined} readOnly required /></div><Field label="Chave de acesso (44 dígitos)" value={invoice.accessKey} onChange={value => setInvoice(current => ({ ...current, accessKey: value }))} required />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([['Produtos', 'productTotal'], ['Frete', 'freightTotal'], ['Desconto', 'discountTotal'], ['Total da NF', 'grossTotal']] as const).map(([label, key]) => <div key={key}><Field label={label} type="number" value={invoice[key]} onChange={value => setInvoice(current => ({ ...current, [key]: value }))} required={key === 'grossTotal'} /></div>)}</div>
            <details className="group rounded-2xl border border-slate-200 bg-slate-50"><summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-black text-slate-700">Informar impostos manualmente <span className="flex items-center gap-2 text-xs font-bold text-slate-400">Opcional <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span></summary><div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-4 sm:grid-cols-4">{taxFields.map(([label, key]) => <div key={key}><Field label={label} type="number" value={invoice[key]} onChange={value => setInvoice(current => ({ ...current, [key]: value }))} /></div>)}</div></details>
          </form></div>
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-black">Cancelar</button><button form="manual-invoice-form" disabled={saving} className="rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white disabled:opacity-50">Salvar NF e comparar</button></footer>
      </div></div>}
    </div>
  );
};
