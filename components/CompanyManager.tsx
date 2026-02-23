import React, { useState, useEffect } from 'react';
import { Company, TaxRegime, CompanyRole } from '../types';
import { 
  Building2, Plus, Search, Trash2, 
  Edit2, Save, X, ShieldCheck, 
  Store, UserCheck, AlertCircle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const CompanyManager: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [taxRegime, setTaxRegime] = useState<TaxRegime>('REAL');
  const [companyRole, setCompanyRole] = useState<CompanyRole>('SUPPLIER');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/companies`);
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, cnpj, taxRegime, companyRole };

    try {
      const url = editingId ? `${API_BASE_URL}/companies/${editingId}` : `${API_BASE_URL}/companies`;
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        fetchCompanies();
        closeModal();
      }
    } catch (error) {
      console.error("Erro ao salvar empresa:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover esta empresa?")) return;
    
    try {
      await fetch(`${API_BASE_URL}/companies/${id}`, { method: 'DELETE' });
      fetchCompanies();
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const openModal = (company?: Company) => {
    if (company) {
      setEditingId(company.id);
      setName(company.name);
      setCnpj(company.cnpj);
      setTaxRegime(company.taxRegime);
      setCompanyRole(company.companyRole);
    } else {
      setEditingId(null);
      setName('');
      setCnpj('');
      setTaxRegime('REAL');
      setCompanyRole('SUPPLIER');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cnpj.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header com Busca e Botão Novo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50">
        <div>
           <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
             <Building2 className="w-5 h-5 text-blue-600" /> Cadastro de Parceiros
           </h2>
           <p className="text-xs text-slate-400 font-bold uppercase mt-1">Gerencie fornecedores e o regime fiscal da RA Polymers</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> NOVO CADASTRO
          </button>
        </div>
      </div>

      {/* Grid de Empresas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((c) => (
          <div key={c.id} className={`bg-white p-6 rounded-[2.5rem] shadow-soft border-2 transition-all group ${c.companyRole === 'BUYER' ? 'border-blue-500/20 bg-blue-50/10' : 'border-transparent hover:border-slate-100'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl ${c.companyRole === 'BUYER' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                {c.companyRole === 'BUYER' ? <ShieldCheck className="w-6 h-6" /> : <Store className="w-6 h-6" />}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal(c)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {c.companyRole === 'BUYER' ? 'Compradora (Nossa Empresa)' : 'Fornecedor Externo'}
              </p>
              <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{c.name}</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">{c.cnpj}</p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Regime Tributário</p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1 ${
                    c.taxRegime === 'REAL' ? 'bg-emerald-100 text-emerald-700' : 
                    c.taxRegime === 'PRESUMIDO' ? 'bg-amber-100 text-amber-700' : 
                    'bg-slate-100 text-slate-600'
                  }`}>
                    LUCRO {c.taxRegime}
                  </span>
               </div>
               
               {c.companyRole === 'BUYER' && (
                 <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">
                   <UserCheck className="w-3 h-3" /> Responsável
                 </div>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{editingId ? 'Editar Cadastro' : 'Novo Parceiro'}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configure o DNA fiscal da empresa</p>
                </div>
                <button onClick={closeModal} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Razão Social / Nome Fantasia</label>
                   <input 
                     required
                     type="text"
                     className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                   />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">CNPJ</label>
                     <input 
                       required
                       type="text"
                       placeholder="00.000.000/0000-00"
                       className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                       value={cnpj}
                       onChange={(e) => setCnpj(e.target.value)}
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Papel no Sistema</label>
                     <select 
                       className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                       value={companyRole}
                       onChange={(e) => setCompanyRole(e.target.value as CompanyRole)}
                     >
                       <option value="SUPPLIER">FORNECEDOR</option>
                       <option value="BUYER">RA POLYMERS (COMPRADOR)</option>
                     </select>
                   </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-3 block tracking-widest">Regime Tributário (Crítico)</label>
                    <div className="grid grid-cols-3 gap-3">
                       {['SIMPLES', 'PRESUMIDO', 'REAL'].map((regime) => (
                         <button
                           key={regime}
                           type="button"
                           onClick={() => setTaxRegime(regime as TaxRegime)}
                           className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${
                             taxRegime === regime ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'
                           }`}
                         >
                           LUCRO {regime}
                         </button>
                       ))}
                    </div>
                    {taxRegime === 'REAL' && (
                      <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mt-3 px-1">
                        <AlertCircle className="w-3 h-3" /> Gera crédito integral de PIS/COFINS (9,25%) e ICMS.
                      </p>
                    )}
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-4 bg-slate-50 text-slate-500 font-black text-xs rounded-2xl hover:bg-slate-100 transition-all uppercase"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 bg-blue-600 text-white font-black text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> {editingId ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
