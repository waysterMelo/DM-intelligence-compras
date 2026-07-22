import React, { useState, useEffect } from 'react';
import { X, Save, Percent, Info } from 'lucide-react';

interface TaxConfig {
  icmsCreditPercentage: number;
  pisCreditPercentage: number;
  cofinsCreditPercentage: number;
  ipiCreditPercentage: number;
}

interface TaxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const TaxSettingsModal: React.FC<TaxSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<TaxConfig>({
    icmsCreditPercentage: 100,
    pisCreditPercentage: 100,
    cofinsCreditPercentage: 100,
    ipiCreditPercentage: 100,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/companies/tax-config`);
      const data = await response.json();
      if (data) setConfig(data);
    } catch (error) {
      console.error("Erro ao buscar config fiscal:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/companies/tax-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        onClose();
      }
    } catch (error) {
      console.error("Erro ao salvar config fiscal:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Aproveitamento Fiscal</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Defina a porcentagem de crédito por imposto</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-6 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
            Estes valores reduzem proporcionalmente o crédito recuperado no cálculo do TCO. 
            Ex: Se o ICMS for 18% e o aproveitamento 50%, o sistema considerará apenas 9% de crédito.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {[
            { label: 'Aproveitamento ICMS', key: 'icmsCreditPercentage' },
            { label: 'Aproveitamento PIS', key: 'pisCreditPercentage' },
            { label: 'Aproveitamento COFINS', key: 'cofinsCreditPercentage' },
            { label: 'Aproveitamento IPI', key: 'ipiCreditPercentage' },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">{field.label}</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-black text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  value={config[field.key as keyof TaxConfig]}
                  onChange={(e) => setConfig({ ...config, [field.key]: parseFloat(e.target.value) || 0 })}
                />
                <Percent className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-slate-50 text-slate-500 font-black text-xs rounded-2xl hover:bg-slate-100 transition-all uppercase"
            >
              Cancelar
            </button>
            <button
              disabled={loading}
              type="submit"
              className="flex-[2] py-4 bg-blue-600 text-white font-black text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Regras'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
