import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Edit2,
  Landmark,
  Percent,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { Company, CompanyRole, TaxRegime } from '../types';
import { TaxSettingsModal } from './TaxSettingsModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const CompanyManager: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [taxRegime, setTaxRegime] = useState<TaxRegime>('REAL');
  const [companyRole, setCompanyRole] = useState<CompanyRole>('SUPPLIER');

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/companies`);
      if (!response.ok) throw new Error('Não foi possível carregar as empresas.');
      setCompanies(await response.json());
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const openModal = (company?: Company) => {
    setEditingId(company?.id || null);
    setName(company?.name || '');
    setCnpj(company?.cnpj || '');
    setTaxRegime(company?.taxRegime || 'REAL');
    setCompanyRole(company?.companyRole || 'SUPPLIER');
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(editingId ? `${API_BASE_URL}/companies/${editingId}` : `${API_BASE_URL}/companies`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, cnpj, taxRegime, companyRole }),
      });
      if (!response.ok) throw new Error('Não foi possível salvar a empresa.');
      await fetchCompanies();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta empresa?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/companies/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível remover a empresa.');
      await fetchCompanies();
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const query = searchTerm.toLowerCase();
    return company.name.toLowerCase().includes(query) || company.cnpj.includes(searchTerm);
  });

  const supplierCount = companies.filter(company => company.companyRole === 'SUPPLIER').length;
  const buyerCount = companies.filter(company => company.companyRole === 'BUYER').length;
  const realRegimeCount = companies.filter(company => company.taxRegime === 'REAL').length;
  const otherRegimeCount = companies.length - realRegimeCount;
  const summaryCards = [
    { label: 'Fornecedores', value: supplierCount, detail: 'Parceiros cadastrados', icon: Store, background: 'bg-[#285BD4]' },
    { label: 'Empresas compradoras', value: buyerCount, detail: 'Unidades com premissas', icon: ShieldCheck, background: 'bg-[#009E68]' },
    { label: 'Regime Lucro Real', value: realRegimeCount, detail: 'Cadastros identificados', icon: Landmark, background: 'bg-[#7134D1]' },
    { label: 'Outros regimes', value: otherRegimeCount, detail: 'Presumido ou Simples', icon: Percent, background: 'bg-[#C65B02]' },
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-soft sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white"><Building2 className="h-5 w-5" /></div>
          <div><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">Cadastro de parceiros</h2><p className="mt-1 text-xs font-medium text-slate-500">Fornecedores e premissas comerciais de TCO.</p></div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <label className="relative min-w-0 flex-1 xl:w-72">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Buscar parceiro" type="text" placeholder="Buscar nome ou CNPJ" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
          </label>
          <button onClick={() => openModal()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" />Novo parceiro</button>
        </div>
      </section>

      <section className="rounded-[2.25rem] bg-[#111827] p-3 shadow-2xl shadow-slate-300/70 sm:p-4">
        <div className="mb-4 flex items-end justify-between gap-4 px-2">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-400">Visão cadastral</p><h2 className="mt-1 text-xl font-black text-white">Fornecedores & TCO</h2></div>
          <p className="hidden text-xs font-semibold text-slate-400 sm:block">{companies.length} empresas cadastradas</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, detail, icon: Icon, background }) => (
            <article key={label} className={`group relative min-h-[132px] overflow-hidden rounded-[1.5rem] border border-white/10 p-4 text-white shadow-lg ${background}`}>
              <Icon className="absolute -right-2 top-3 h-24 w-24 text-white opacity-[0.13] transition-transform duration-500 group-hover:-translate-x-1" strokeWidth={1.5} />
              <div className="relative z-10 flex h-full flex-col"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/15"><Icon className="h-4 w-4" /></span><p className="text-[9px] font-black uppercase tracking-wide">{label}</p></div><div className="mt-auto flex items-end justify-between gap-3"><p className="text-3xl font-black">{value}</p><p className="text-right text-[8px] font-extrabold text-white/85">{detail}</p></div></div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between px-1"><div><h3 className="text-lg font-black text-slate-900">Parceiros cadastrados</h3><p className="text-xs font-medium text-slate-500">Edite dados ou abra as premissas da empresa compradora.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black uppercase text-blue-700">{filteredCompanies.length} resultados</span></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredCompanies.map(company => (
            <article key={company.id} className="group flex min-h-[190px] flex-col overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-soft-hover">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${company.companyRole === 'BUYER' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-white'}`}>{company.companyRole === 'BUYER' ? <ShieldCheck className="h-4 w-4" /> : <Store className="h-4 w-4" />}</div>
                <div className="flex gap-1"><button onClick={() => openModal(company)} aria-label={`Editar ${company.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button><button onClick={() => handleDelete(company.id)} aria-label={`Excluir ${company.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
              </div>
              <div className="mt-4 min-w-0"><p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">{company.companyRole === 'BUYER' ? 'Empresa compradora' : 'Fornecedor externo'}</p><h3 className="mt-1 truncate text-base font-black text-slate-900" title={company.name}>{company.name}</h3><p className="mt-1 truncate text-[10px] font-bold text-slate-400">{company.cnpj}</p></div>
              <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3"><div><p className="text-[8px] font-black uppercase text-slate-400">Regime</p><span className={`mt-1 inline-block rounded-lg px-2 py-1 text-[8px] font-black uppercase ${company.taxRegime === 'REAL' ? 'bg-emerald-50 text-emerald-700' : company.taxRegime === 'PRESUMIDO' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>{company.taxRegime}</span></div>{company.companyRole === 'BUYER' ? <button onClick={() => setIsTaxModalOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[8px] font-black uppercase text-white transition hover:bg-blue-700"><Settings2 className="h-3.5 w-3.5" />Premissas TCO</button> : <span className="rounded-lg bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-500">Fornecedor</span>}</div>
            </article>
          ))}
        </div>
        {!filteredCompanies.length && <div className="mt-4 rounded-[2rem] border border-dashed border-slate-300 bg-white py-14 text-center"><UsersRound className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600">Nenhum parceiro encontrado</p><p className="mt-1 text-xs text-slate-400">Revise a busca ou cadastre uma nova empresa.</p></div>}
      </section>

      <TaxSettingsModal isOpen={isTaxModalOpen} onClose={() => setIsTaxModalOpen(false)} />

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="flex items-start justify-between bg-slate-950 p-6 text-white"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Fornecedores & TCO</p><h3 className="mt-1 text-xl font-black">{editingId ? 'Editar parceiro' : 'Novo parceiro'}</h3><p className="mt-1 text-xs text-slate-400">Dados comerciais utilizados pela equipe de Compras.</p></div><button type="button" onClick={closeModal} aria-label="Fechar" className="rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-white/15 hover:text-white"><X className="h-5 w-5" /></button></header>
            <form onSubmit={handleSave} className="space-y-5 p-6">
              <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">Razão social / Nome fantasia</span><input required type="text" value={name} onChange={event => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">CNPJ</span><input required type="text" placeholder="00.000.000/0000-00" value={cnpj} onChange={event => setCnpj(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label><label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">Papel no sistema</span><select value={companyRole} onChange={event => setCompanyRole(event.target.value as CompanyRole)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"><option value="SUPPLIER">Fornecedor</option><option value="BUYER">Empresa compradora</option></select></label></div>
              <div><p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Regime tributário</p><div className="grid grid-cols-3 gap-2">{(['SIMPLES', 'PRESUMIDO', 'REAL'] as TaxRegime[]).map(regime => <button key={regime} type="button" onClick={() => setTaxRegime(regime)} className={`rounded-xl border px-2 py-3 text-[8px] font-black uppercase transition ${taxRegime === regime ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}>{regime}</button>)}</div>{taxRegime === 'REAL' && <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700"><AlertCircle className="h-3.5 w-3.5" />Os percentuais do TCO são definidos nas premissas de Compras.</p>}</div>
              <footer className="flex gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={closeModal} className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-black uppercase text-slate-600">Cancelar</button><button type="submit" className="flex-[1.6] items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black uppercase text-white hover:bg-blue-700"><span className="flex items-center justify-center gap-2"><Save className="h-4 w-4" />{editingId ? 'Salvar alterações' : 'Finalizar cadastro'}</span></button></footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
