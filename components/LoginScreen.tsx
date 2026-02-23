import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import { 
  LogIn, Building2, User, Lock, ArrowRight, ArrowLeft, 
  Briefcase, CheckCircle2, Mail, Activity, TrendingUp, 
  Fingerprint, Shield, Cpu 
} from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, company: Company) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  // --- LÓGICA DE NEGÓCIO EXISTENTE ---
  const [isRegistering, setIsRegistering] = useState(false);
  const [step, setStep] = useState(1);
  
  // User Data
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Company Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
  const [newCompanyRegime, setNewCompanyRegime] = useState<'SIMPLES' | 'PRESUMIDO' | 'REAL'>('REAL');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Efeitos Visuais do Novo Design
  const [isHovering, setIsHovering] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/companies`);
      if (res.ok) {
        const data: Company[] = await res.json();
        const buyers = data.filter(c => c.companyRole === 'BUYER');
        setCompanies(buyers);
        if (buyers.length > 0) setSelectedCompanyId(buyers[0].id);
      }
    } catch (e) {
      console.error('Erro ao carregar empresas', e);
      setError('Não foi possível carregar as empresas. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError('');
    if (!fullName || !role || !username || !password) {
      setError('Preencha todos os campos do funcionário.');
      return;
    }
    if (password.length < 3) {
      setError('Senha muito curta (mínimo 3 caracteres).');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
        if (isRegistering) {
            if (step === 1) {
                handleNextStep();
                setLoading(false);
                return;
            }

            let companyId = selectedCompanyId;
            let companyObj: Company | undefined;

            if (isNewCompany) {
                if (!newCompanyName || !newCompanyCnpj) {
                    throw new Error('Informe o nome e o CNPJ da nova empresa.');
                }
                
                const compRes = await fetch(`${API_BASE_URL}/companies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newCompanyName,
                        cnpj: newCompanyCnpj,
                        taxRegime: newCompanyRegime,
                        companyRole: 'BUYER'
                    })
                });

                if (!compRes.ok) throw new Error('Erro ao criar empresa. Verifique se o CNPJ já existe.');
                companyObj = await compRes.json();
                companyId = companyObj!.id;
            } else {
                companyObj = companies.find(c => c.id === companyId);
                if (!companyObj) throw new Error('Empresa inválida.');
            }

            const userRes = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fullName,
                    username,
                    password,
                    role,
                    companyId
                })
            });

            if (!userRes.ok) {
                const errData = await userRes.json();
                throw new Error(errData.message || 'Erro ao criar usuário.');
            }

            setSuccessMsg('Conta criada com sucesso! Acessando...');
            setTimeout(() => {
                onLogin(`${fullName} • ${role}`, companyObj!);
            }, 1000);

        } else {
            // Login Real
            if (!username || !password) {
                throw new Error('Preencha usuário e senha.');
            }

            const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!loginRes.ok) {
                throw new Error('Usuário ou senha inválidos.');
            }

            const data = await loginRes.json();
            // data = { access_token, user }
            // Em uma implementação completa, salvaríamos o access_token no localStorage aqui.
            // localStorage.setItem('token', data.access_token);
            
            const user = data.user;
            onLogin(`${user.name} • ${user.role}`, user.company);
        }
    } catch (err: any) {
        console.error(err);
        setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
        if (!isRegistering || step === 2) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-[#050505] font-sans text-slate-300 overflow-hidden relative selection:bg-blue-500/30">
      
      {/* Estilos customizados */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
        @keyframes float-delayed { 0% { transform: translateY(0px); } 50% { transform: translateY(-15px); } 100% { transform: translateY(0px); } }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite 2s; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px #0a0a0a inset !important;
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
        }
      `}} />

      {/* BACKGROUND EFFECTS */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(29, 78, 216, 0.12), transparent 40%)`
        }}
      />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-indigo-900/20 blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex w-full h-screen z-10 relative">
        
        {/* LADO ESQUERDO: Branding */}
        <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 xl:p-20 relative">
          <div className="flex items-center gap-4 z-20">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)] border border-blue-400/20 relative group overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="text-white font-black text-2xl tracking-tighter relative z-10">DM</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase leading-none">Intelligence</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Motor de Compras Ativo</p>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-lg mx-auto h-[400px] flex items-center justify-center z-10">
            <div className="absolute w-[300px] h-[300px] border border-white/5 rounded-full flex items-center justify-center">
              <div className="w-[200px] h-[200px] border border-white/5 rounded-full border-dashed animate-[spin_60s_linear_infinite]"></div>
            </div>
            <div className="absolute top-10 -left-10 glass-panel p-5 rounded-2xl w-64 animate-float shadow-2xl z-20">
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20"><Activity className="w-4 h-4 text-blue-400" /></div>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-md flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12.4%</span>
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Saving Gerado (Mês)</p>
              <h3 className="text-2xl font-black text-white font-mono">R$ 142.590<span className="text-slate-500 text-lg">,00</span></h3>
            </div>
            <div className="absolute bottom-10 -right-4 glass-panel p-5 rounded-2xl w-72 animate-float-delayed shadow-2xl z-30">
              <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20"><Cpu className="w-4 h-4 text-indigo-400" /></div>
                <div><h4 className="text-sm font-bold text-white">Cálculo de TCO</h4><p className="text-[10px] text-slate-400">Motor de Impostos (IPI/ICMS/PIS)</p></div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs"><span className="text-slate-400">Precisão Algorítmica</span><span className="text-white font-mono">99.9%</span></div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-gradient-to-r from-blue-500 to-indigo-500 w-[99%] h-full rounded-full relative"><div className="absolute right-0 top-0 bottom-0 w-4 bg-white/50 blur-[2px] animate-pulse"></div></div></div>
              </div>
            </div>
          </div>

          <div className="z-20">
            <h2 className="text-4xl font-black text-white leading-tight mb-4 tracking-tight">A engenharia de dados <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">aplicada aos suprimentos.</span></h2>
            <p className="text-slate-400 font-medium max-w-md leading-relaxed text-sm">Desenvolvido pela Dimelonari Group. Transformamos processos de compras complexos em decisões exatas através de inteligência fiscal.</p>
          </div>
        </div>

        {/* LADO DIREITO: Formulário */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-20">
          <div className="w-full max-w-md relative">
            <div className="glass-panel p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

              {/* Cabeçalho do Form */}
              <div className="mb-8 text-center relative">
                {isRegistering && step === 2 && (
                   <button type="button" onClick={() => setStep(1)} className="absolute left-0 top-0 p-2 text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                )}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0a0a0a] border border-white/5 shadow-inner mb-6 relative">
                  {isRegistering ? (step === 1 ? <User className="w-8 h-8 text-blue-500/80" /> : <Building2 className="w-8 h-8 text-blue-500/80" />) : <Fingerprint className="w-8 h-8 text-blue-500/80" />}
                  <div className="absolute inset-0 rounded-full border border-blue-500/20 animate-[spin_4s_linear_infinite]"></div>
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
                  {isRegistering ? (step === 1 ? 'Cadastro: Funcionário' : 'Cadastro: Empresa') : 'Acesso Autorizado'}
                </h3>
                <p className="text-sm text-slate-400">
                  {isRegistering ? 'Preencha os dados para configurar seu acesso.' : 'Insira as suas credenciais para aceder ao sistema.'}
                </p>
              </div>

              {/* Mensagens de Erro/Sucesso */}
              {error && <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center animate-pulse">{error}</div>}
              {successMsg && <div className="p-4 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold text-center">{successMsg}</div>}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* CAMPOS DO FORMULÁRIO (DINÂMICO) */}
                {(!isRegistering || step === 1) && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    {isRegistering && (
                      <>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                          <input type="text" placeholder="Nome Completo" className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus />
                        </div>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Briefcase className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                          <input type="text" placeholder="Cargo / Função" className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" value={role} onChange={e => setRole(e.target.value)} />
                        </div>
                      </>
                    )}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                      <input type="text" placeholder="Usuário / Login" className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                      <input type="password" placeholder="Palavra-passe" className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* STEP 2: EMPRESA */}
                {isRegistering && step === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-4 border border-white/5">
                      <button type="button" onClick={() => setIsNewCompany(false)} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${!isNewCompany ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Vincular</button>
                      <button type="button" onClick={() => setIsNewCompany(true)} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${isNewCompany ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Nova Empresa</button>
                    </div>

                    {!isNewCompany ? (
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Building2 className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                        <select className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} disabled={loading}>
                          {loading ? <option>Carregando...</option> : companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          {!loading && companies.length === 0 && <option value="">Nenhuma empresa disponível</option>}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Building2 className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                          <input type="text" placeholder="Razão Social" className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} autoFocus />
                        </div>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Briefcase className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                          <input type="text" placeholder="CNPJ" className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" value={newCompanyCnpj} onChange={e => setNewCompanyCnpj(e.target.value)} />
                        </div>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><CheckCircle2 className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400" /></div>
                          <select className="block w-full pl-12 pr-4 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer" value={newCompanyRegime} onChange={e => setNewCompanyRegime(e.target.value as any)}>
                             <option value="REAL">Lucro Real</option>
                             <option value="PRESUMIDO">Lucro Presumido</option>
                             <option value="SIMPLES">Simples Nacional</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button type="submit" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} disabled={loading} className="w-full relative flex justify-center items-center gap-3 bg-white text-black font-bold py-3.5 px-4 rounded-xl transition-all duration-300 hover:scale-[1.02] overflow-hidden group mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="relative z-10">{isRegistering ? (step === 1 ? 'Continuar' : 'Finalizar') : 'Autenticar Sistema'}</span>
                  <ArrowRight className={`w-4 h-4 relative z-10 transition-transform duration-300 ${isHovering ? 'translate-x-1' : ''}`} />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              </form>

              <div className="mt-6 text-center">
                <button onClick={() => { setIsRegistering(!isRegistering); setStep(1); setError(''); }} className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  {isRegistering ? 'Já possui acesso? Entrar' : 'Não tem conta? Solicitar Acesso'}
                </button>
              </div>
            </div>

            <div className="mt-8 text-center flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Conexão Encriptada (SSL/TLS 1.3)</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">© {new Date().getFullYear()} DM Intelligence. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
