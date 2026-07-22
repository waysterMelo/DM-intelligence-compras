import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Plus, Receipt, X, Zap } from 'lucide-react';
import { Company, Department, ItemUseType, QuickPurchaseInput, QuickPurchaseTaxInput, Requisition, SupplierQuote } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const departments: Department[] = ['Produção', 'Ferramentaria', 'Manutenção', 'Escritório', 'Logística'];

interface QuickPurchasesProps {
  requisitions: Requisition[];
  onCreate: (data: QuickPurchaseInput) => Promise<void>;
  onFiscalEntry: (id: string, data: QuickPurchaseTaxInput) => Promise<void>;
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numeric = (value: string) => value === '' ? undefined : Number(value.replace(',', '.'));

export const QuickPurchases: React.FC<QuickPurchasesProps> = ({ requisitions, onCreate, onFiscalEntry }) => {
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [form, setForm] = useState({
    name: '', quantity: '1', unit: 'un', unitPrice: '', freight: '', supplierId: '',
    department: 'Produção' as Department, requester: '', paymentTerms: '', notes: '',
  });
  const [invoice, setInvoice] = useState({
    invoiceNumber: '', invoiceAccessKey: '', invoiceIssueDate: new Date().toISOString().slice(0, 10),
    itemUseType: 'INDUSTRIAL_INPUT' as ItemUseType,
    cstIcms: '', csosn: '', icmsRate: '', icmsValue: '',
    cstPis: '', pisRate: '', pisValue: '', cstCofins: '', cofinsRate: '', cofinsValue: '',
    ipiRate: '', ipiValue: '', cstIbsCbs: '', taxClassCode: '', cbsRate: '0,9', cbsValue: '', ibsRate: '0,1', ibsValue: '',
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/companies/suppliers`)
      .then(response => response.ok ? response.json() : [])
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, []);

  const quickPurchases = useMemo(
    () => requisitions.filter(item => item.purchaseMode === 'QUICK'),
    [requisitions],
  );
  const pending = quickPurchases.filter(item => item.taxStatus === 'PENDING_INVOICE');

  const submitPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onCreate({
        name: form.name,
        quantity: Number(form.quantity),
        unit: form.unit,
        unitPrice: Number(form.unitPrice.replace(',', '.')),
        freight: Number(form.freight.replace(',', '.') || 0),
        supplierId: form.supplierId,
        department: form.department,
        requester: form.requester,
        paymentTerms: form.paymentTerms,
        notes: form.notes,
      });
      setForm(current => ({ ...current, name: '', quantity: '1', unitPrice: '', freight: '', notes: '' }));
      setMessage('Compra registrada. A apuração fiscal ficou pendente até a chegada da NF.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao registrar a compra.');
    } finally {
      setSaving(false);
    }
  };

  const submitInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const baseQuote = selected.quotes[0];
    setSaving(true);
    setMessage(null);
    try {
      const quote: SupplierQuote = {
        ...baseQuote,
        itemUseType: invoice.itemUseType,
        cstIcms: invoice.cstIcms || undefined,
        csosn: invoice.csosn || undefined,
        icmsRate: numeric(invoice.icmsRate), icmsValue: numeric(invoice.icmsValue),
        cstPis: invoice.cstPis || undefined,
        pisRate: numeric(invoice.pisRate), pisValue: numeric(invoice.pisValue),
        cstCofins: invoice.cstCofins || undefined,
        cofinsRate: numeric(invoice.cofinsRate), cofinsValue: numeric(invoice.cofinsValue),
        ipiRate: numeric(invoice.ipiRate), ipiValue: numeric(invoice.ipiValue),
        cstIbsCbs: invoice.cstIbsCbs || undefined,
        taxClassCode: invoice.taxClassCode || undefined,
        cbsRate: numeric(invoice.cbsRate), cbsValue: numeric(invoice.cbsValue),
        ibsRate: numeric(invoice.ibsRate), ibsValue: numeric(invoice.ibsValue),
      };
      await onFiscalEntry(selected.id, {
        invoiceNumber: invoice.invoiceNumber,
        invoiceAccessKey: invoice.invoiceAccessKey,
        invoiceIssueDate: invoice.invoiceIssueDate,
        quote,
      });
      setSelected(null);
      setMessage('Nota registrada e memória fiscal calculada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao registrar a nota.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, options?: { type?: string; required?: boolean }) => (
    <label className="space-y-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <input
        type={options?.type || 'text'} required={options?.required} value={form[key] as string}
        onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
      />
    </label>
  );

  const taxField = (label: string, key: keyof typeof invoice, placeholder = '') => (
    <label className="space-y-1.5">
      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <input value={invoice[key]} placeholder={placeholder} onChange={event => setInvoice(current => ({ ...current, [key]: event.target.value }))}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-blue-500" />
    </label>
  );

  return (
    <div className="space-y-6 pb-10">
      {message && <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">{message}</div>}

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(420px,0.9fr)_1.4fr]">
        <form onSubmit={submitPurchase} className="rounded-[2.5rem] border border-slate-100 bg-white p-7 shadow-sm lg:p-9">
          <div className="mb-7 flex items-center gap-4">
            <div className="rounded-2xl bg-blue-600 p-3 text-white"><Zap className="h-5 w-5" /></div>
            <div><h2 className="text-xl font-black text-slate-900">Nova compra rápida</h2><p className="text-xs font-medium text-slate-400">Sem estimativa tributária nesta etapa.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">{field('Descrição do item', 'name', { required: true })}</div>
            {field('Quantidade', 'quantity', { type: 'number', required: true })}
            {field('Unidade', 'unit', { required: true })}
            {field('Preço unitário', 'unitPrice', { required: true })}
            {field('Frete total', 'freight')}
            <label className="col-span-2 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor cadastrado</span>
              <select required value={form.supplierId} onChange={event => setForm(current => ({ ...current, supplierId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                <option value="">Selecione...</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Departamento</span>
              <select value={form.department} onChange={event => setForm(current => ({ ...current, department: event.target.value as Department }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
                {departments.map(department => <option key={department}>{department}</option>)}
              </select>
            </label>
            {field('Solicitante', 'requester', { required: true })}
            <div className="col-span-2">{field('Condição de pagamento', 'paymentTerms')}</div>
            <div className="col-span-2">{field('Observações', 'notes')}</div>
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> Os impostos não serão zerados: a compra ficará marcada como aguardando nota fiscal.
          </div>
          <button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Registrar compra
          </button>
        </form>

        <section className="rounded-[2.5rem] border border-slate-100 bg-white p-7 shadow-sm lg:p-9">
          <div className="mb-7 flex items-center justify-between">
            <div><h2 className="text-xl font-black text-slate-900">Regularização fiscal</h2><p className="text-xs font-medium text-slate-400">Compras aguardando a nota do fornecedor.</p></div>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-700">{pending.length} pendentes</span>
          </div>
          <div className="space-y-3">
            {quickPurchases.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-sm font-bold text-slate-400">Nenhuma compra rápida registrada.</div>}
            {quickPurchases.map(item => {
              const quote = item.quotes[0];
              const isPending = item.taxStatus === 'PENDING_INVOICE';
              return <article key={item.id} className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5 md:flex-row md:items-center">
                <div className={`rounded-2xl p-3 ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{isPending ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate font-black text-slate-800">{item.name}</p><p className="mt-1 text-xs font-semibold text-slate-400">{item.quantity} {item.unit} · {quote?.supplierName || 'Fornecedor'} · total {money((item.finalCost || 0) * item.quantity)}</p></div>
                {isPending ? <button onClick={() => setSelected(item)} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white"><Receipt className="h-4 w-4" /> Lançar NF</button>
                  : <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black uppercase text-emerald-700"><FileText className="h-4 w-4" /> NF {item.invoiceNumber}</div>}
              </article>;
            })}
          </div>
        </section>
      </div>

      {selected && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
        <form onSubmit={submitInvoice} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2.5rem] bg-white p-7 shadow-2xl lg:p-10">
          <div className="mb-7 flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">Entrada fiscal posterior</p><h3 className="mt-1 text-2xl font-black text-slate-900">{selected.name}</h3><p className="mt-1 text-xs text-slate-400">Informe os dados exatamente como constam na NF. Valores de tributos são unitários.</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-2xl bg-slate-100 p-3"><X className="h-5 w-5" /></button></div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {taxField('Número da NF', 'invoiceNumber')}{taxField('Data de emissão', 'invoiceIssueDate')}{taxField('Chave NF-e (44 dígitos)', 'invoiceAccessKey')}
            <label className="space-y-1.5"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Destinação</span><select value={invoice.itemUseType} onChange={event => setInvoice(current => ({ ...current, itemUseType: event.target.value as ItemUseType }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"><option value="INDUSTRIAL_INPUT">Insumo industrial</option><option value="RESALE">Revenda</option><option value="CONSUMPTION">Uso e consumo</option><option value="FIXED_ASSET">Ativo imobilizado</option></select></label>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5"><h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-700">ICMS / IPI</h4><div className="grid grid-cols-2 gap-3">{taxField('CST ICMS', 'cstIcms')}{taxField('CSOSN', 'csosn')}{taxField('ICMS %', 'icmsRate')}{taxField('ICMS R$ unit.', 'icmsValue')}{taxField('IPI %', 'ipiRate')}{taxField('IPI R$ unit.', 'ipiValue')}</div></div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5"><h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-700">PIS / Cofins</h4><div className="grid grid-cols-2 gap-3">{taxField('CST PIS entrada', 'cstPis')}{taxField('PIS %', 'pisRate')}{taxField('PIS R$ unit.', 'pisValue')}{taxField('CST Cofins entrada', 'cstCofins')}{taxField('Cofins %', 'cofinsRate')}{taxField('Cofins R$ unit.', 'cofinsValue')}</div></div>
            <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 md:col-span-2"><div className="mb-4 flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-widest text-blue-800">IBS / CBS — transição 2026</h4><span className="rounded-full bg-blue-100 px-3 py-1 text-[9px] font-black uppercase text-blue-700">Informativo no TCO</span></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{taxField('CST IBS/CBS', 'cstIbsCbs')}{taxField('cClassTrib', 'taxClassCode')}{taxField('CBS %', 'cbsRate')}{taxField('CBS R$ unit.', 'cbsValue')}{taxField('IBS %', 'ibsRate')}{taxField('IBS R$ unit.', 'ibsValue')}</div></div>
          </div>
          <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} className="rounded-2xl bg-slate-100 px-6 py-4 text-xs font-black uppercase text-slate-500">Cancelar</button><button disabled={saving} className="rounded-2xl bg-emerald-600 px-8 py-4 text-xs font-black uppercase text-white disabled:opacity-50">Salvar nota e calcular</button></div>
        </form>
      </div>}
    </div>
  );
};
