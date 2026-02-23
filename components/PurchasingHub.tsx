import React, { useState, useEffect, useCallback } from 'react';
import { Requisition, Status, SupplierQuote, Company } from '../types';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { 
  Play, DollarSign, Ban, Trash2, Trophy, 
  Calculator, Truck, Receipt, Calendar, CreditCard, 
  Save, CheckCircle2, X, Building2, TrendingDown, Info,
  Sparkles, ShieldCheck, PieChart, MousePointer2, Briefcase, Landmark
} from 'lucide-react';
import { CurrencyInput } from './CurrencyInput';

interface PurchasingHubProps {
  requisitions: Requisition[];
  onUpdateStatus: (id: string, status: Status, finalCost?: number, paymentTerms?: string) => void;
  onUpdateQuotes: (id: string, quotes: SupplierQuote[]) => void;
  onDelete: (id: string) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const PurchasingHub: React.FC<PurchasingHubProps> = ({ requisitions, onUpdateStatus, onUpdateQuotes, onDelete }) => {
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [activeSuppIdx, setActiveSuppIdx] = useState(0);
  const [localQuotes, setLocalQuotes] = useState<Record<string, SupplierQuote[]>>({});
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [buyer, setBuyer] = useState<Company | null>(null);
  const [showSavingModal, setShowSavingModal] = useState<boolean>(false);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(0);
  
  // Filtros e Paginação da Fila
  const [statusFilter, setStatusFilter] = useState<Status | 'Pendentes'>('Pendentes');
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 4;

  const filteredQueue = requisitions.filter(r => {
    if (statusFilter === 'Pendentes') return r.status === 'Solicitado' || r.status === 'Cotando';
    return r.status === statusFilter;
  });

  const totalPages = Math.ceil(filteredQueue.length / ITEMS_PER_PAGE);
  const displayedItems = filteredQueue.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
     setPage(0);
  }, [statusFilter]);

  // Removida a seleção automática do primeiro item para cumprir o requisito #1
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

      if (suppRes.ok) {
          const data = await suppRes.json().catch(() => []);
          setSuppliers(data);
      }
      
      if (buyerRes.ok) {
          const data = await buyerRes.json().catch(() => null);
          setBuyer(data);
      }
    } catch (e) { console.error('Error fetching initial data:', e); }
  };

  const persistChanges = (reqId: string, quotes: SupplierQuote[]) => {
    onUpdateQuotes(reqId, quotes);
  };

  const handleLocalUpdate = (reqId: string, idx: number, field: keyof SupplierQuote, value: any) => {
    setLocalQuotes(prev => {
      const newQuotes = [...(prev[reqId] || [])];
      newQuotes[idx] = { ...newQuotes[idx], [field]: value };
      if (field === 'companyId') {
        const selected = suppliers.find(s => s.id === value);
        if (selected) newQuotes[idx].supplierName = selected.name;
        persistChanges(reqId, newQuotes);
      }
      return { ...prev, [reqId]: newQuotes };
    });
  };

  const calculateTco = (req: Requisition, quote: SupplierQuote) => {
    const base = quote.price || 0;
    const freight = (quote.freight || 0) / (req.quantity || 1);
    const ipi = base * ((quote.ipiRate || 0)/100);
    const icms = base * ((quote.icmsRate || 0)/100);
    const pis = base * ((quote.pisRate || 0)/100);
    const cofins = base * ((quote.cofinsRate || 0)/100);
    const gross = base + freight + ipi + icms + pis + cofins;
    let credits = 0;
    if (buyer?.taxRegime === 'REAL') credits += icms + pis + cofins;
    return { gross, net: gross - credits, credits };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const selectedReq = requisitions.find(r => r.id === selectedReqId);
  const activeQuotes = localQuotes[selectedReqId || ''] || [];
  const activeQuote = activeQuotes[activeSuppIdx];
  const winner = activeQuotes.find(q => q.isSelected);

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-700">
      
      {/* 1. FILA DE TRABALHO HORIZONTAL */}
      <div className="flex flex-col gap-3">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-amber-500" /> Fila de Suprimentos
              </h3>
              <select 
                 value={statusFilter} 
                 onChange={(e) => setStatusFilter(e.target.value as any)}
                 className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 px-2 py-1 rounded-lg border-none outline-none cursor-pointer"
              >
                 <option value="Pendentes">Pendentes (Ação)</option>
                 <option value="Aprovado">Aprovados</option>
                 <option value="Comprado">Comprados</option>
                 <option value="Rejeitado">Suspensos</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
               <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter mr-2">
                  {filteredQueue.length} Itens
               </span>
               <button 
                 disabled={page === 0}
                 onClick={() => setPage(p => Math.max(0, p - 1))}
                 className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
               >
                 <Briefcase className="w-4 h-4 rotate-180" /> {/* Using generic icon as placeholder for arrow if needed, but standard arrow is better */}
                 {/* Reusing existing icons to avoid import errors, assuming ChevronLeft/Right not imported yet. Adding them now if needed or using text */}
                 <span className="text-xs font-bold">←</span>
               </button>
               <button 
                 disabled={page >= totalPages - 1}
                 onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                 className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
               >
                 <span className="text-xs font-bold">→</span>
               </button>
            </div>
         </div>
         <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar scroll-smooth min-h-[220px]">
            {displayedItems.length === 0 ? (
               <div className="w-full bg-white/50 border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                  <p className="text-sm font-bold italic">Nenhum item nesta visualização.</p>
               </div>
            ) : (
               displayedItems.map(req => (
                  <button
                     key={req.id}
                     onClick={() => { setSelectedReqId(req.id); setActiveSuppIdx(0); }}
                     className={`flex-shrink-0 w-72 p-6 rounded-[2.5rem] border-2 transition-all duration-500 text-left relative overflow-hidden group ${selectedReqId === req.id ? 'bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-300 -translate-y-1' : 'bg-white border-white text-slate-500 hover:border-blue-100 hover:shadow-lg shadow-soft'}`}
                  >
                     <div className="flex justify-between items-start mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${selectedReqId === req.id ? 'text-slate-500' : 'text-slate-300'}`}>{req.id}</span>
                        <PriorityBadge priority={req.priority} />
                     </div>
                     <h4 className="font-black text-base leading-tight mb-4 h-10 overflow-hidden line-clamp-2">{req.name}</h4>
                     <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{req.department}</span>
                        <span className={`text-sm font-black ${selectedReqId === req.id ? 'text-blue-400' : 'text-slate-900'}`}>{req.quantity} {req.unit}</span>
                     </div>
                     {selectedReqId === req.id && <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>}
                  </button>
               ))
            )}
         </div>
      </div>

      {/* 2. ÁREA DE NEGOCIAÇÃO OU PLACEHOLDER */}
      {selectedReq ? (
         <div className="flex-1 bg-slate-100/80 rounded-[4rem] p-4 lg:p-8 flex flex-col xl:flex-row gap-8 shadow-inner border border-white animate-in slide-in-from-bottom-4 duration-700">
            {/* Esquerda: Info Card */}
            <div className="xl:w-80 flex flex-col gap-6">
               <div className="bg-white p-8 rounded-[3.5rem] shadow-soft border border-slate-50 flex flex-col gap-6">
                  <div className="flex justify-between items-start">
                     <StatusBadge status={selectedReq.status} />
                     <button onClick={() => onDelete(selectedReq.id)} className="p-3 bg-slate-50 text-slate-300 hover:text-rose-500 rounded-2xl transition-all"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Requisição Ativa</p>
                     <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tighter">{selectedReq.name}</h2>
                     <div className="space-y-1 mt-4">
                        <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> {selectedReq.department}</p>
                        <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><Landmark className="w-3.5 h-3.5" /> {selectedReq.requester}</p>
                     </div>
                  </div>
                  <button onClick={() => onUpdateStatus(selectedReq.id, 'Rejeitado')} className="w-full flex items-center justify-center gap-3 py-5 border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-3xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"><Ban className="w-4 h-4" /> Suspender Operação</button>
               </div>

               {buyer && (
                 <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3.5rem] text-white shadow-2xl shadow-blue-200 flex flex-col gap-4 relative overflow-hidden group">
                    <ShieldCheck className="absolute top-0 right-0 p-4 w-24 h-24 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Contexto Fiscal RA Polymers</p>
                    <h4 className="text-2xl font-black uppercase tracking-tighter">{buyer.taxRegime}</h4>
                    <p className="text-[11px] font-bold leading-relaxed opacity-80">Configurado para captura automática de créditos em insumos industriais.</p>
                 </div>
               )}
            </div>

            {/* Direita: Negotiation Board */}
            <div className="flex-1 flex flex-col gap-6" onBlur={() => persistChanges(selectedReq.id, activeQuotes)}>
               <div className="flex gap-3 bg-white/60 backdrop-blur-xl p-2.5 rounded-[3rem] shadow-sm border border-white">
                  {[0, 1, 2].map(idx => {
                    const q = activeQuotes[idx];
                    const active = activeSuppIdx === idx;
                    const colors = ['from-blue-500 to-blue-600 shadow-blue-200', 'from-indigo-500 to-indigo-600 shadow-indigo-200', 'from-violet-500 to-violet-600 shadow-violet-200'];
                    return (
                      <button key={idx} onClick={() => { persistChanges(selectedReq.id, activeQuotes); setActiveSuppIdx(idx); }} className={`flex-1 py-5 px-6 rounded-[2.5rem] flex items-center justify-center gap-3 transition-all duration-500 ${active ? `bg-gradient-to-tr ${colors[idx]} text-white shadow-2xl scale-[1.02]` : 'bg-white/50 text-slate-400 hover:bg-white hover:text-slate-600'}`}>
                         <Building2 className={`w-4 h-4 ${active ? 'opacity-100' : 'opacity-30'}`} />
                         <span className="text-[10px] font-black uppercase tracking-[0.15em]">{q?.supplierName ? q.supplierName.substring(0, 12) : `OPÇÃO ${idx + 1}`}</span>
                         {q?.isSelected && <Trophy className="w-4 h-4 text-amber-300 animate-pulse" />}
                      </button>
                    );
                  })}
               </div>

               <div className="bg-white rounded-[4rem] p-10 lg:p-14 shadow-soft border border-slate-50 flex flex-col gap-10 animate-in zoom-in-95 duration-700">
                  <div className="flex flex-col lg:flex-row gap-12">
                     <div className="flex-1 space-y-8">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-3 block">Fornecedor Selecionado</label>
                           <select className="w-full bg-slate-50 border-2 border-slate-100 px-8 py-5 rounded-3xl text-sm font-black text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer shadow-inner" value={activeQuote?.companyId || ''} onChange={(e) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'companyId', e.target.value)}>
                              <option value="">Selecione um parceiro...</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} • {s.taxRegime}</option>)}
                           </select>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           <CurrencyInput label="Preço Unitário" value={activeQuote?.price || 0} onChange={(v) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'price', v)} icon={<DollarSign className="w-3.5 h-3.5"/>} />
                           <CurrencyInput label="Frete Total" value={activeQuote?.freight || 0} onChange={(v) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'freight', v)} icon={<Truck className="w-3.5 h-3.5"/>} color="indigo" />
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-2"><Calendar className="w-3.5 h-3.5"/> Prazo (Dias)</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-blue-500 rounded-3xl px-8 py-4 text-sm font-black text-slate-700 outline-none transition-all shadow-inner" value={activeQuote?.leadTime || 0} onChange={(e) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'leadTime', parseInt(e.target.value) || 0)} /></div>
                           <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-2"><CreditCard className="w-3.5 h-3.5"/> Condição Pagto</label><input type="text" placeholder="Ex: 28dd" className="w-full bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-blue-500 rounded-3xl px-8 py-4 text-sm font-black text-slate-700 outline-none transition-all shadow-inner" value={activeQuote?.paymentTerms || ''} onChange={(e) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'paymentTerms', e.target.value)} /></div>
                        </div>
                     </div>
                     <div className="flex-1 space-y-8">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2 mb-2 px-2"><Receipt className="w-4 h-4" /> Componentes Tributários (%)</p>
                        <div className="grid grid-cols-2 gap-8">
                           <CurrencyInput label="IPI (%)" prefix="" value={activeQuote?.ipiRate || 0} onChange={(v) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'ipiRate', v)} color="amber" />
                           <CurrencyInput label="ICMS (%)" prefix="" value={activeQuote?.icmsRate || 0} onChange={(v) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'icmsRate', v)} color="amber" />
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           <CurrencyInput label="PIS (%)" prefix="" value={activeQuote?.pisRate || 0} onChange={(v) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'pisRate', v)} color="amber" />
                           <CurrencyInput label="COFINS (%)" prefix="" value={activeQuote?.cofinsRate || 0} onChange={(v) => handleLocalUpdate(selectedReq.id, activeSuppIdx, 'cofinsRate', v)} color="amber" />
                        </div>
                        <div className="bg-amber-50/50 p-6 rounded-[2.5rem] border border-amber-100/50 text-[10px] font-bold text-amber-800/70 flex items-center gap-4 italic leading-relaxed">
                           <Info className="w-6 h-6 flex-shrink-0 text-amber-500" />
                           O Motor Fiscal processa os créditos automaticamente com base no perfil do comprador {buyer?.name || 'RA Polymers'}.
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t border-slate-50">
                     <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl shadow-slate-300">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-50">Custo Bruto Unitário</p>
                        <p className="text-4xl font-black tracking-tighter">{formatCurrency(calculateTco(selectedReq, activeQuote).gross)}</p>
                     </div>
                     <div className="bg-emerald-600 p-10 rounded-[3.5rem] text-white flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl shadow-emerald-200 border-b-8 border-emerald-700">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-70">Custo Líquido (Net Cost)</p>
                        <p className="text-5xl font-black tracking-tighter">{formatCurrency(calculateTco(selectedReq, activeQuote).net)}</p>
                        <button onClick={() => { handleLocalUpdate(selectedReq.id, activeSuppIdx, 'isSelected', true); setNegotiatedPrice(activeQuote.price); setShowSavingModal(true); }} disabled={!activeQuote?.companyId || !activeQuote?.price} className={`mt-10 w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${activeQuote?.isSelected ? 'bg-amber-400 text-slate-900 shadow-xl' : 'bg-white text-emerald-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50'}`}><Trophy className="w-5 h-5" /> {activeQuote?.isSelected ? 'Vencedor Confirmado' : 'Eleger Melhor TCO'}</button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      ) : (
         <div className="flex-1 flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in-95 duration-1000">
            <div className="w-32 h-32 bg-white rounded-[3.5rem] shadow-soft flex items-center justify-center mb-8 relative border border-slate-50 group">
               <div className="absolute inset-0 bg-blue-500/5 rounded-[3.5rem] animate-ping opacity-20"></div>
               <MousePointer2 className="w-12 h-12 text-blue-600 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="font-black text-slate-800 text-3xl tracking-tighter uppercase">Inicie sua Negociação</h3>
            <p className="text-slate-400 font-bold mt-2 tracking-wide uppercase text-[10px]">Selecione um item na fila de suprimentos acima para abrir o board.</p>
            <div className="mt-12 flex gap-4">
               <div className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Motor Fiscal Pronto</span>
               </div>
               <div className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conexão Segura</span>
               </div>
            </div>
         </div>
      )}

      {/* 3. MODAL DE RESUMO DE SAVING */}
      {showSavingModal && selectedReq && winner && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl p-12 lg:p-16 animate-in zoom-in-95 duration-500 border border-white/20">
               <div className="flex justify-between items-start mb-12">
                  <div><p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2">Finalização Estratégica</p><h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Resumo de Saving</h3></div>
                  <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100"><PieChart className="w-10 h-10 text-emerald-600" /></div>
               </div>
               <div className="space-y-8">
                  <div className="flex items-center gap-6 p-8 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-inner">
                     <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center text-blue-600 font-black text-xl shadow-lg border border-slate-50">1</div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Parceiro Eleito</p><p className="text-2xl font-black text-slate-800 tracking-tight">{winner.supplierName}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 text-center shadow-inner"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Melhor Oferta</p><p className="text-3xl font-black text-slate-700 tracking-tighter">{formatCurrency(winner.price)}</p></div>
                     <CurrencyInput label="Negociado Final" value={negotiatedPrice} onChange={(v) => setNegotiatedPrice(v)} color="emerald" />
                  </div>
                  <div className="bg-emerald-600 p-10 rounded-[3.5rem] text-white flex flex-col gap-3 relative overflow-hidden shadow-2xl shadow-emerald-200 border-b-8 border-emerald-700">
                     <div className="flex justify-between items-center"><p className="text-[10px] font-black uppercase opacity-70 tracking-[0.3em]">Saving Comercial Absoluto</p><span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">-{Math.round(((winner.price - negotiatedPrice) / winner.price) * 100) || 0}%</span></div>
                     <p className="text-5xl font-black tracking-tighter">{formatCurrency((winner.price - negotiatedPrice) * selectedReq.quantity)}</p>
                  </div>
               </div>
               <div className="mt-14 flex gap-6">
                  <button onClick={() => setShowSavingModal(false)} className="flex-1 py-6 bg-slate-100 text-slate-500 font-black text-xs rounded-[2rem] uppercase tracking-widest hover:bg-slate-200 transition-all">Revisar</button>
                  <button onClick={() => { onUpdateStatus(selectedReq.id, 'Comprado', negotiatedPrice, winner.paymentTerms); setShowSavingModal(false); setSelectedReqId(null); }} className="flex-[2] py-6 bg-emerald-600 text-white font-black text-xs rounded-[2rem] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-95"><CheckCircle2 className="w-6 h-6" /> Confirmar e Finalizar</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
