import React, { useState, useEffect } from 'react';
import { Requisition, SupplierQuote, Company, ItemUseType } from '../types';
import { 
  Trophy, Calculator, Save, X, Trash2, 
  Truck, Receipt, Calendar, CreditCard, ChevronLeft,
  Info, TrendingDown, Landmark, FileSearch
} from 'lucide-react';

interface TcoManagerProps {
  requisition: Requisition;
  onSave: (id: string, quotes: SupplierQuote[]) => void;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const TcoManager: React.FC<TcoManagerProps> = ({ requisition, onSave, onClose }) => {
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [buyer, setBuyer] = useState<Company | null>(null);
  const [showTaxMemory, setShowTaxMemory] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [requisition]);

  const fetchInitialData = async () => {
    try {
      const [suppRes, buyerRes] = await Promise.all([
        fetch(`${API_BASE_URL}/companies/suppliers`),
        fetch(`${API_BASE_URL}/companies/buyer`)
      ]);
      setSuppliers(await suppRes.json());
      setBuyer(await buyerRes.json());

      const existingQuotes = [...(requisition.quotes || [])];
      while (existingQuotes.length < 3) {
        existingQuotes.push({ 
          id: Math.random().toString(), 
          supplierName: '', 
          price: 0, 
          freight: 0, 
          ipiRate: 0,
          icmsRate: 0,
          pisRate: 0,
          cofinsRate: 0,
          itemUseType: 'INDUSTRIAL_INPUT',
          leadTime: 0, 
          paymentTerms: '', 
          isSelected: false 
        });
      }
      setQuotes(existingQuotes);
    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
    }
  };

  const handleUpdateQuote = (idx: number, field: keyof SupplierQuote, value: any) => {
    const newQuotes = [...quotes];
    newQuotes[idx] = { ...newQuotes[idx], [field]: value };
    
    if (field === 'companyId') {
      const selected = suppliers.find(s => s.id === value);
      if (selected) newQuotes[idx].supplierName = selected.name;
    }
    
    setQuotes(newQuotes);
  };

  const calculateFiscalResult = (quote: SupplierQuote) => {
    const basePrice = quote.price || 0;
    const freightUnit = (quote.freight || 0) / (requisition.quantity || 1);
    
    // 1. Impostos Pagos na Nota (Custos)
    const ipi = basePrice * ((quote.ipiRate || 0) / 100);
    const icms = basePrice * ((quote.icmsRate || 0) / 100);
    const pis = basePrice * ((quote.pisRate || 0) / 100);
    const cofins = basePrice * ((quote.cofinsRate || 0) / 100);
    const grossCostUnit = basePrice + freightUnit + ipi + icms + pis + cofins;

    // 2. Créditos Recuperáveis (O que volta para o caixa)
    let creditIcms = 0;
    let creditPis = 0;
    let creditCofins = 0;
    let creditIpi = 0;

    const isInputOrResale = ['INDUSTRIAL_INPUT', 'RESALE'].includes(quote.itemUseType || 'INDUSTRIAL_INPUT');

    // Regra ICMS: Crédito se for Insumo/Revenda
    if (isInputOrResale) creditIcms = icms;

    // Regra PIS/COFINS: Só se RA Polymers (Buyer) for LUCRO REAL
    if (buyer?.taxRegime === 'REAL' && isInputOrResale) {
      creditPis = pis;
      creditCofins = cofins;
    }

    // Regra IPI: Se for Insumo Industrial e Comprador for Indústria (Real/Presumido)
    if (buyer?.taxRegime !== 'SIMPLES' && quote.itemUseType === 'INDUSTRIAL_INPUT') {
      creditIpi = ipi;
    }

    const totalCredits = creditIcms + creditPis + creditCofins + creditIpi;
    const netCostUnit = grossCostUnit - totalCredits;

    return {
      grossCostUnit,
      netCostUnit,
      credits: { icms: creditIcms, pis: creditPis, cofins: creditCofins, ipi: creditIpi },
      totalCredits
    };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-white rounded-[3rem] shadow-soft border border-slate-50 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header */}
      <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all hover:scale-105">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Análise de Custo Efetivo</p>
               {buyer && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg uppercase">RA Polymers: {buyer.taxRegime}</span>}
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase">Motor de TCO Fiscal</h2>
          </div>
        </div>

        <div className="hidden md:flex flex-col text-right">
           <span className="text-lg font-black text-blue-600">{requisition.name}</span>
           <span className="text-xs font-bold text-slate-400 uppercase">{requisition.quantity} {requisition.unit} • {requisition.department}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {quotes.map((quote, idx) => {
            const fiscal = calculateFiscalResult(quote);
            const selectedSupplier = suppliers.find(s => s.id === quote.companyId);
            
            return (
              <div key={idx} className={`relative p-8 rounded-[3.5rem] transition-all border-2 flex flex-col ${quote.isSelected ? 'bg-white border-blue-500 shadow-2xl shadow-blue-100 scale-[1.02] z-10' : 'bg-white/80 border-slate-100 hover:border-slate-200 shadow-sm'}`}>
                
                <div className="absolute -top-3 left-8 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                   OPÇÃO {idx + 1}
                </div>

                <div className="space-y-6 flex-1">
                  {/* FORNECEDOR E DESTINAÇÃO */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 flex justify-between">
                        <span>Fornecedor</span>
                        {selectedSupplier && <span className="text-blue-600 font-black">LUCRO {selectedSupplier.taxRegime}</span>}
                      </label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={quote.companyId || ''}
                        onChange={(e) => handleUpdateQuote(idx, 'companyId', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Destinação do Item</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={quote.itemUseType || 'INDUSTRIAL_INPUT'}
                        onChange={(e) => handleUpdateQuote(idx, 'itemUseType', e.target.value as ItemUseType)}
                      >
                        <option value="INDUSTRIAL_INPUT">Insumo Industrial (Gera Crédito)</option>
                        <option value="RESALE">Revenda (Gera Crédito)</option>
                        <option value="CONSUMPTION">Uso e Consumo (Sem Crédito)</option>
                        <option value="FIXED_ASSET">Ativo Imobilizado</option>
                      </select>
                    </div>
                  </div>

                  {/* PREÇO E FRETE */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Preço Unit. Bruto</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">R$</span>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500"
                          value={quote.price || ''}
                          onChange={(e) => handleUpdateQuote(idx, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Frete Total</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">R$</span>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500"
                          value={quote.freight || ''}
                          onChange={(e) => handleUpdateQuote(idx, 'freight', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* IMPOSTOS DETALHADOS */}
                  <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                       <Receipt className="w-4 h-4 text-blue-500" /> Impostos da Operação (%)
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {[
                        { label: 'IPI', field: 'ipiRate', color: 'text-amber-600' },
                        { label: 'ICMS', field: 'icmsRate', color: 'text-blue-600' },
                        { label: 'PIS', field: 'pisRate', color: 'text-violet-600' },
                        { label: 'COFINS', field: 'cofinsRate', color: 'text-indigo-600' }
                      ].map(tax => (
                        <div key={tax.field}>
                          <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block ml-1">{tax.label}</label>
                          <div className="relative">
                            <input 
                              type="number"
                              className={`w-full bg-white border border-slate-100 pr-7 pl-3 py-2.5 rounded-xl text-xs font-black outline-none focus:border-blue-500 ${tax.color}`}
                              value={(quote as any)[tax.field] || ''}
                              onChange={(e) => handleUpdateQuote(idx, tax.field as any, parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RESULTADO FISCAL: CRÉDITOS */}
                  <div className="bg-emerald-50/50 p-6 rounded-[2.5rem] border border-emerald-100 relative overflow-hidden group/tax">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" /> Créditos Recuperáveis
                      </p>
                      <button 
                        onClick={() => setShowTaxMemory(showTaxMemory === idx ? null : idx)}
                        className="p-1.5 bg-white text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                        title="Ver Memória de Cálculo"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-600/70">ICMS:</span>
                        <span className="text-emerald-700">+{formatCurrency(fiscal.credits.icms)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-600/70">PIS/COFINS:</span>
                        <span className="text-emerald-700">+{formatCurrency(fiscal.credits.pis + fiscal.credits.cofins)}</span>
                      </div>
                      <div className="pt-2 border-t border-emerald-100 flex justify-between">
                        <span className="text-[10px] font-black text-emerald-800 uppercase">Total Créditos:</span>
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(fiscal.totalCredits)}</span>
                      </div>
                    </div>

                    {showTaxMemory === idx && (
                      <div className="absolute inset-0 bg-emerald-600 p-6 text-white animate-in slide-in-from-bottom-full duration-300">
                         <div className="flex justify-between items-start mb-4">
                           <p className="text-[10px] font-black uppercase tracking-widest">Memória de Cálculo</p>
                           <button onClick={() => setShowTaxMemory(null)}><X className="w-4 h-4" /></button>
                         </div>
                         <p className="text-[11px] leading-relaxed font-medium">
                           {buyer?.taxRegime === 'REAL' ? '✅ Comprador é Lucro Real. ' : '⚠️ Comprador não é Real (Sem crédito PIS/COFINS). '}
                           {['INDUSTRIAL_INPUT', 'RESALE'].includes(quote.itemUseType || '') ? '✅ Item gera crédito de entrada. ' : '⚠️ Uso do item não permite crédito. '}
                           <br/><br/>
                           Base ICMS: {formatCurrency(quote.price || 0)} x {quote.icmsRate}% = {formatCurrency(fiscal.credits.icms)}
                         </p>
                      </div>
                    )}
                  </div>

                  {/* DISPLAY FINAL: CUSTO LÍQUIDO (O VENCEDOR REAL) */}
                  <div className={`p-8 rounded-[3rem] flex flex-col items-center justify-center transition-all ${quote.isSelected ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-slate-900 text-white shadow-lg'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Custo Efetivo (Net Cost)</p>
                    <p className="text-4xl font-black tracking-tighter">{formatCurrency(fiscal.netCostUnit)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-lg uppercase">Economia Real vs Bruto: {Math.round((fiscal.totalCredits / fiscal.grossCostUnit) * 100) || 0}%</span>
                    </div>
                    
                    <button 
                      onClick={() => handleSelectWinner(idx)}
                      disabled={!quote.companyId || !quote.price}
                      className={`mt-8 w-full py-4 rounded-2xl font-black text-xs transition-all uppercase flex items-center justify-center gap-2 ${quote.isSelected ? 'bg-white text-blue-600 shadow-inner' : 'bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50'}`}
                    >
                      {quote.isSelected ? <><Trophy className="w-4 h-4" /> Opção Escolhida</> : 'Selecionar Pelo Custo Líquido'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-3">
         <div className="flex-1 flex items-center gap-3 text-slate-400">
            <Landmark className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-600 leading-tight">Inteligência Fiscal Ativada</p>
              <p className="text-[9px] font-medium leading-tight max-w-sm">O sistema está calculando créditos de PIS, COFINS, ICMS e IPI com base no regime da RA Polymers e na destinação do item.</p>
            </div>
         </div>
         <button onClick={onClose} className="px-8 py-4 bg-slate-50 text-slate-500 font-black text-xs rounded-2xl hover:bg-slate-100 transition-all uppercase">Cancelar</button>
         <button onClick={() => onSave(requisition.id, quotes)} className="px-12 py-4 bg-blue-600 text-white font-black text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase flex items-center gap-2">
           <Save className="w-4 h-4" /> Salvar Mapa e TCO
         </button>
      </div>
    </div>
  );
};
