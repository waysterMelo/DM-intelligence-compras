import React, { useState, useEffect } from 'react';
import { Requisition, Status, SupplierQuote, Company } from '../types';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { 
  Play, DollarSign, Ban, Trash2, Trophy, 
  Calculator, Truck, Receipt, Calendar, CreditCard, 
  Save, CheckCircle2, X, Building2, TrendingDown, Info
} from 'lucide-react';

interface QuoteListProps {
  requisitions: Requisition[];
  onUpdateStatus: (id: string, status: Status, finalCost?: number, paymentTerms?: string) => void;
  onUpdateQuotes: (id: string, quotes: SupplierQuote[]) => void;
  onDelete: (id: string) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const QuoteList: React.FC<QuoteListProps> = ({ requisitions, onUpdateStatus, onUpdateQuotes, onDelete }) => {
  const [activeTabs, setActiveTabs] = useState<Record<string, number>>({});
  const [localQuotes, setLocalQuotes] = useState<Record<string, SupplierQuote[]>>({});
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [buyer, setBuyer] = useState<Company | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Inicializa os dados locais das cotações para permitir edição fluida
  useEffect(() => {
    const initialMap: Record<string, SupplierQuote[]> = {};
    requisitions.forEach(req => {
      const qts = [...(req.quotes || [])];
      while (qts.length < 3) {
        qts.push({ 
          id: Math.random().toString(), supplierName: '', price: 0, freight: 0, 
          ipiRate: 0, icmsRate: 0, pisRate: 0, cofinsRate: 0, 
          leadTime: 0, paymentTerms: '', isSelected: false 
        });
      }
      initialMap[req.id] = qts;
    });
    setLocalQuotes(initialMap);
  }, [requisitions]);

  const fetchInitialData = async () => {
    try {
      const [suppRes, buyerRes] = await Promise.all([
        fetch(`${API_BASE_URL}/companies/suppliers`),
        fetch(`${API_BASE_URL}/companies/buyer`)
      ]);
      setSuppliers(await suppRes.json());
      setBuyer(await buyerRes.json());
    } catch (e) { console.error(e); }
  };

  const handleLocalUpdate = (reqId: string, quoteIdx: number, field: keyof SupplierQuote, value: any) => {
    setLocalQuotes(prev => {
      const newQuotes = [...(prev[reqId] || [])];
      newQuotes[quoteIdx] = { ...newQuotes[quoteIdx], [field]: value };
      
      if (field === 'companyId') {
        const selected = suppliers.find(s => s.id === value);
        if (selected) newQuotes[quoteIdx].supplierName = selected.name;
      }
      
      return { ...prev, [reqId]: newQuotes };
    });
  };

  const calculatePreview = (req: Requisition, quote: SupplierQuote) => {
    const base = quote.price || 0;
    const freight = (quote.freight || 0) / (req.quantity || 1);
    const taxes = (base * (quote.ipiRate || 0)/100) + (base * (quote.icmsRate || 0)/100) + (base * (quote.pisRate || 0)/100) + (base * (quote.cofinsRate || 0)/100);
    const gross = base + freight + taxes;

    // Lógica simplificada de crédito para o preview
    let credits = 0;
    if (buyer?.taxRegime === 'REAL') {
       credits += (base * (quote.icmsRate || 0)/100);
       credits += (base * (quote.pisRate || 0)/100);
       credits += (base * (quote.cofinsRate || 0)/100);
    }
    return { gross, net: gross - credits };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const items = requisitions.filter(r => r.status === 'Solicitado' || r.status === 'Cotando');

  if (items.length === 0) {
    return (
      <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner">
        <p className="font-extrabold text-slate-400 text-xl">Nenhuma requisição aguardando cotação</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      {items.map((req) => {
        const currentQuotes = localQuotes[req.id] || [];
        const activeIdx = activeTabs[req.id] || 0;
        const activeQuote = currentQuotes[activeIdx];

        return (
          <div key={req.id} className="bg-white rounded-[3rem] p-8 shadow-soft border border-slate-50 flex flex-col xl:flex-row gap-8 hover:shadow-xl transition-all border-l-8 border-l-blue-500">
            
            {/* Esquerda: Info da Requisição */}
            <div className="xl:w-80 flex flex-col border-b xl:border-b-0 xl:border-r border-slate-100 pb-6 xl:pb-0 xl:pr-8">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-2">
                  <StatusBadge status={req.status} />
                  <PriorityBadge priority={req.priority} />
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{req.id}</span>
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight">{req.name}</h3>
              <p className="text-sm text-slate-500 font-bold mb-6">{req.department} • <span className="text-slate-400">por {req.requester}</span></p>

              <div className="mt-auto bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Quantidade</span>
                   <span className="text-lg font-black text-slate-700">{req.quantity} {req.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Data Pedido</span>
                   <span className="text-xs font-bold text-slate-600">{new Date(req.requestDate).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button 
                  onClick={() => onUpdateStatus(req.id, 'Rejeitado')}
                  className="flex-1 py-3 text-[10px] font-black uppercase text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Ban className="w-3 h-3" /> Suspender
                </button>
                <button 
                  onClick={() => onDelete(req.id)}
                  className="p-3 text-slate-300 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Direita: Abas de Cotação e TCO */}
            <div className="flex-1 flex flex-col">
              {/* Header das Abas */}
              <div className="flex gap-2 mb-6 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                {[0, 1, 2].map(idx => {
                  const q = currentQuotes[idx];
                  const hasData = q?.supplierName && q?.price > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveTabs(prev => ({ ...prev, [req.id]: idx }))}
                      className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeIdx === idx ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {q?.isSelected && <Trophy className="w-3.5 h-3.5" />}
                      {hasData ? q.supplierName.substring(0, 12) + '...' : `OPÇÃO ${idx + 1}`}
                      {hasData && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                    </button>
                  );
                })}
              </div>

              {activeQuote && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Coluna 1: Dados do Fornecedor */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest flex justify-between">
                        <span>Fornecedor Cadastrado</span>
                        {suppliers.find(s => s.id === activeQuote.companyId) && <span className="text-blue-600 font-black">LUCRO {suppliers.find(s => s.id === activeQuote.companyId)?.taxRegime}</span>}
                      </label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        value={activeQuote.companyId || ''}
                        onChange={(e) => handleLocalUpdate(req.id, activeIdx, 'companyId', e.target.value)}
                      >
                        <option value="">Selecione um fornecedor...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Preço Unitário</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                          value={activeQuote.price || ''}
                          onChange={(e) => handleLocalUpdate(req.id, activeIdx, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest flex items-center gap-1"><Truck className="w-3 h-3" /> Frete Total</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                          value={activeQuote.freight || ''}
                          onChange={(e) => handleLocalUpdate(req.id, activeIdx, 'freight', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> Prazo (Dias)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                          value={activeQuote.leadTime || ''}
                          onChange={(e) => handleLocalUpdate(req.id, activeIdx, 'leadTime', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest flex items-center gap-1"><CreditCard className="w-3 h-3" /> Pagamento</label>
                        <input 
                          type="text"
                          className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                          value={activeQuote.paymentTerms || ''}
                          onChange={(e) => handleLocalUpdate(req.id, activeIdx, 'paymentTerms', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Coluna 2: Impostos e Custo Líquido */}
                  <div className="flex flex-col gap-4">
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-blue-500" /> Impostos (%)
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {['ipiRate', 'icmsRate', 'pisRate', 'cofinsRate'].map(field => (
                          <div key={field}>
                            <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block ml-1">{field.replace('Rate', '').toUpperCase()}</label>
                            <input 
                              type="number"
                              className="w-full bg-white border border-slate-100 px-3 py-2 rounded-xl text-xs font-black text-blue-600 outline-none focus:border-blue-500"
                              value={(activeQuote as any)[field] || ''}
                              onChange={(e) => handleLocalUpdate(req.id, activeIdx, field as any, parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white flex flex-col justify-center items-center shadow-lg relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-16 h-16" /></div>
                       <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Custo Efetivo Estimado</p>
                       <p className="text-3xl font-black">{formatCurrency(calculatePreview(req, activeQuote).net)}</p>
                       <p className="text-[10px] font-bold mt-1 text-emerald-400 uppercase">Bruto: {formatCurrency(calculatePreview(req, activeQuote).gross)}</p>

                       <button 
                        onClick={() => {
                          const newQ = currentQuotes.map((q, i) => ({ ...q, isSelected: i === activeIdx }));
                          setLocalQuotes(prev => ({ ...prev, [req.id]: newQ }));
                        }}
                        disabled={!activeQuote.companyId || !activeQuote.price}
                        className={`mt-4 w-full py-3 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${activeQuote.isSelected ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-blue-600 hover:text-white disabled:opacity-50'}`}
                       >
                         {activeQuote.isSelected ? <><CheckCircle2 className="w-3.5 h-3.5" /> Opção Vencedora</> : 'Marcar como Melhor TCO'}
                       </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400">
                  <Info className="w-4 h-4" />
                  <p className="text-[10px] font-bold uppercase">Preencha os impostos para calcular o Custo Real.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => onUpdateQuotes(req.id, currentQuotes)}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Salvar Cotações do Item
                  </button>
                  {currentQuotes.some(q => q.isSelected) && (
                    <button 
                      onClick={() => {
                        const win = currentQuotes.find(q => q.isSelected);
                        if(win) onUpdateStatus(req.id, 'Comprado', win.price, win.paymentTerms);
                      }}
                      className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Finalizar Compra
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};