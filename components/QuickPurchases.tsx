import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCode2, Plus, Receipt, Upload, X, Zap } from 'lucide-react';
import { Company, CostReconciliationStatus, Department, ManualInvoiceInput, QuickPurchaseInput, Requisition } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const departments: Department[] = ['Produção', 'Ferramentaria', 'Manutenção', 'Escritório', 'Logística'];
const money = (value?: number | null) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const number = (value: string) => Number(value.replace(',', '.')) || 0;

interface QuickPurchasesProps {
  requisitions: Requisition[];
  onCreate: (data: QuickPurchaseInput) => Promise<void>;
  onManualInvoice: (id: string, data: ManualInvoiceInput) => Promise<void>;
  onXmlInvoice: (id: string, file: File) => Promise<void>;
  onReconcile: (id: string, acceptDivergence?: boolean) => Promise<void>;
}

const statusLabels: Record<CostReconciliationStatus, string> = {
  NOT_REQUIRED: 'Não aplicável',
  PENDING_INVOICE: 'Aguardando NF',
  INVOICE_RECEIVED: 'NF recebida',
  COST_CONFIRMED: 'Custo conferido',
  DIVERGENCE_FOUND: 'Divergência encontrada',
};

const Field = ({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) => (
  <label className="block"><span className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><input required={required} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" /></label>
);

export const QuickPurchases: React.FC<QuickPurchasesProps> = ({ requisitions, onCreate, onManualInvoice, onXmlInvoice, onReconcile }) => {
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', quantity: '1', unit: 'un', unitPrice: '', freight: '', supplierId: '', department: 'Produção' as Department, requester: '', paymentTerms: '', notes: '' });
  const [invoice, setInvoice] = useState({ number: '', series: '', accessKey: '', issueDate: new Date().toISOString().slice(0, 10), supplierCnpj: '', productTotal: '', freightTotal: '', discountTotal: '', grossTotal: '', icmsTotal: '', ipiTotal: '', pisTotal: '', cofinsTotal: '', stTotal: '', fcpTotal: '', difalTotal: '' });

  useEffect(() => {
    fetch(`${API_BASE_URL}/companies/suppliers`).then(response => response.ok ? response.json() : []).then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  const purchases = useMemo(() => requisitions.filter(item => ['Comprado', 'Entregue'].includes(item.status)), [requisitions]);
  const pendingCount = purchases.filter(item => item.costReconciliationStatus === 'PENDING_INVOICE').length;

  const createPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onCreate({ name: form.name, quantity: number(form.quantity), unit: form.unit, unitPrice: number(form.unitPrice), freight: number(form.freight), supplierId: form.supplierId, department: form.department, requester: form.requester, paymentTerms: form.paymentTerms, notes: form.notes });
      setForm(current => ({ ...current, name: '', quantity: '1', unitPrice: '', freight: '', notes: '' }));
      setMessage('Compra registrada sem exigir tributos. O item permanecerá aguardando a NF.');
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
      await onManualInvoice(selected.id, {
        number: invoice.number,
        series: invoice.series,
        accessKey: invoice.accessKey.replace(/\D/g, ''),
        issueDate: invoice.issueDate,
        supplierCnpj: invoice.supplierCnpj.replace(/\D/g, ''),
        productTotal: number(invoice.productTotal),
        freightTotal: number(invoice.freightTotal),
        discountTotal: number(invoice.discountTotal),
        grossTotal: number(invoice.grossTotal),
        icmsTotal: number(invoice.icmsTotal),
        ipiTotal: number(invoice.ipiTotal),
        pisTotal: number(invoice.pisTotal),
        cofinsTotal: number(invoice.cofinsTotal),
        stTotal: number(invoice.stTotal),
        fcpTotal: number(invoice.fcpTotal),
        difalTotal: number(invoice.difalTotal),
      });
      setSelected(null);
      setMessage('NF registrada e custo comparado com a cotação.');
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
      setMessage('XML importado e custo comparado com a cotação.');
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
    <div className="space-y-6 pb-12">
      <div className="grid lg:grid-cols-[420px,1fr] gap-6">
        <form onSubmit={createPurchase} className="bg-white rounded-[2rem] border border-slate-100 shadow-soft p-6 h-fit">
          <div className="flex gap-3 mb-6"><div className="p-3 bg-amber-100 text-amber-700 rounded-2xl"><Zap className="w-5 h-5" /></div><div><h2 className="text-xl font-black">Nova compra rápida</h2><p className="text-xs text-slate-400">Sem preenchimento tributário obrigatório</p></div></div>
          <div className="space-y-4">
            <Field label="Item" value={form.name} onChange={name => setForm(current => ({ ...current, name }))} required />
            <div className="grid grid-cols-3 gap-3"><Field label="Quantidade" type="number" value={form.quantity} onChange={quantity => setForm(current => ({ ...current, quantity }))} required /><Field label="Unidade" value={form.unit} onChange={unit => setForm(current => ({ ...current, unit }))} required /><Field label="Preço unit." type="number" value={form.unitPrice} onChange={unitPrice => setForm(current => ({ ...current, unitPrice }))} required /></div>
            <Field label="Frete total" type="number" value={form.freight} onChange={freight => setForm(current => ({ ...current, freight }))} />
            <label className="block"><span className="block mb-1 text-[10px] font-black uppercase text-slate-400">Fornecedor</span><select required value={form.supplierId} onChange={event => setForm(current => ({ ...current, supplierId: event.target.value }))} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold"><option value="">Selecione</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3"><label><span className="block mb-1 text-[10px] font-black uppercase text-slate-400">Departamento</span><select value={form.department} onChange={event => setForm(current => ({ ...current, department: event.target.value as Department }))} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold">{departments.map(department => <option key={department}>{department}</option>)}</select></label><Field label="Comprador" value={form.requester} onChange={requester => setForm(current => ({ ...current, requester }))} /></div>
            <Field label="Condição de pagamento" value={form.paymentTerms} onChange={paymentTerms => setForm(current => ({ ...current, paymentTerms }))} />
            <button disabled={saving} className="w-full rounded-xl bg-amber-500 py-3.5 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" />Registrar compra</button>
          </div>
        </form>

        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between"><div><h2 className="text-xl font-black">Conferência de notas</h2><p className="text-xs text-slate-400">{pendingCount} compras aguardando NF</p></div><Receipt className="w-6 h-6 text-blue-500" /></div>
          <div className="divide-y divide-slate-100">
            {purchases.map(purchase => {
              const status = purchase.costReconciliationStatus || 'PENDING_INVOICE';
              const invoiceData = purchase.purchaseInvoice;
              return <div key={purchase.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-black text-slate-800">{purchase.name}</p><p className="text-xs text-slate-400">{purchase.quantity} {purchase.unit} · {purchase.quotes.find(quote => quote.isSelected)?.supplierName || purchase.quotes[0]?.supplierName}</p></div><span className={`h-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${status === 'DIVERGENCE_FOUND' ? 'bg-rose-100 text-rose-700' : status === 'COST_CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabels[status]}</span></div>
                {invoiceData && <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs"><div><span className="text-slate-400">Cotado bruto</span><p className="font-black">{money(invoiceData.quotedGrossTotal)}</p></div><div><span className="text-slate-400">NF</span><p className="font-black">{money(invoiceData.grossTotal)}</p></div><div><span className="text-slate-400">Dif. frete</span><p className="font-black">{money(invoiceData.freightVariance)}</p></div><div><span className="text-slate-400">Dif. tributos</span><p className="font-black">{money(invoiceData.taxVariance)}</p></div><div><span className="text-slate-400">TCO realizado estimado</span><p className="font-black">{money(invoiceData.actualNetEstimatedTotal)}</p></div><div><span className="text-slate-400">Dif. TCO</span><p className={`font-black ${Math.abs(invoiceData.netVariance) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(invoiceData.netVariance)}</p></div></div>}
                <div className="mt-4 flex gap-2">{status === 'PENDING_INVOICE' && <button onClick={() => openInvoice(purchase)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white flex items-center gap-2"><Upload className="w-4 h-4" />Receber NF</button>}{['INVOICE_RECEIVED', 'DIVERGENCE_FOUND'].includes(status) && <button disabled={saving} onClick={() => confirmCost(purchase)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white flex items-center gap-2">{status === 'DIVERGENCE_FOUND' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}Confirmar conferência</button>}</div>
              </div>;
            })}
            {!purchases.length && <div className="p-14 text-center text-slate-400"><Clock3 className="w-10 h-10 mx-auto mb-3 text-slate-200" />Nenhuma compra concluída.</div>}
          </div>
        </section>
      </div>
      {message && <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm font-bold text-blue-800">{message}</div>}

      {selected && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] p-7 max-w-3xl w-full max-h-[92vh] overflow-y-auto"><div className="flex justify-between mb-6"><div><h3 className="text-xl font-black">Receber NF — {selected.name}</h3><p className="text-xs text-slate-400">A cotação será mantida; os valores realizados serão guardados separadamente.</p></div><button onClick={() => setSelected(null)} aria-label="Fechar"><X className="w-5 h-5" /></button></div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 mb-6"><div className="flex gap-3"><FileCode2 className="w-5 h-5 text-blue-600" /><div className="flex-1"><p className="font-black text-sm text-blue-900">Importar XML da NF-e 4.0</p><p className="text-xs text-blue-700 mb-3">O arquivo será validado por estrutura, chave, duplicidade e CNPJ do fornecedor.</p><input type="file" accept=".xml,text/xml,application/xml" onChange={event => setXmlFile(event.target.files?.[0] || null)} className="text-xs" /><button type="button" disabled={!xmlFile || saving} onClick={submitXml} className="ml-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Importar XML</button></div></div></div>
        <div className="flex items-center gap-3 mb-5"><div className="h-px bg-slate-200 flex-1" /><span className="text-[10px] uppercase font-black text-slate-400">ou informar manualmente</span><div className="h-px bg-slate-200 flex-1" /></div>
        <form onSubmit={submitManual} className="space-y-5"><div className="grid md:grid-cols-4 gap-3"><Field label="Número" value={invoice.number} onChange={number => setInvoice(current => ({ ...current, number }))} required /><Field label="Série" value={invoice.series} onChange={series => setInvoice(current => ({ ...current, series }))} /><Field label="Data de emissão" type="date" value={invoice.issueDate} onChange={issueDate => setInvoice(current => ({ ...current, issueDate }))} required /><Field label="CNPJ fornecedor" value={invoice.supplierCnpj} onChange={supplierCnpj => setInvoice(current => ({ ...current, supplierCnpj }))} required /></div><Field label="Chave de acesso (44 dígitos)" value={invoice.accessKey} onChange={accessKey => setInvoice(current => ({ ...current, accessKey }))} required />
          <div className="grid md:grid-cols-4 gap-3">{([['Produtos', 'productTotal'], ['Frete', 'freightTotal'], ['Desconto', 'discountTotal'], ['Total da NF', 'grossTotal']] as const).map(([label, key]) => <div key={key}><Field label={label} type="number" value={invoice[key]} onChange={value => setInvoice(current => ({ ...current, [key]: value }))} required={key === 'grossTotal'} /></div>)}</div>
          <div><p className="text-xs font-black uppercase text-slate-500 mb-3">Impostos informados na NF</p><div className="grid md:grid-cols-4 gap-3">{([['ICMS', 'icmsTotal'], ['IPI', 'ipiTotal'], ['PIS', 'pisTotal'], ['Cofins', 'cofinsTotal'], ['ICMS-ST', 'stTotal'], ['FCP', 'fcpTotal'], ['DIFAL', 'difalTotal']] as const).map(([label, key]) => <div key={key}><Field label={label} type="number" value={invoice[key]} onChange={value => setInvoice(current => ({ ...current, [key]: value }))} /></div>)}</div></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} className="px-5 py-3 rounded-xl bg-slate-100 text-xs font-black">Cancelar</button><button disabled={saving} className="px-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50">Salvar NF e comparar</button></div>
        </form>
      </div></div>}
    </div>
  );
};
