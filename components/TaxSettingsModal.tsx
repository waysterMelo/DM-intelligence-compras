import React, { useEffect, useState } from 'react';
import { Info, Percent, Save, X } from 'lucide-react';
import { ItemUseType, TcoAssumption } from '../types';

interface TaxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const uses: Array<{ key: ItemUseType; label: string }> = [
  { key: 'INDUSTRIAL_INPUT', label: 'Insumo industrial' },
  { key: 'RESALE', label: 'Revenda' },
  { key: 'FIXED_ASSET', label: 'Ativo' },
  { key: 'CONSUMPTION', label: 'Uso / consumo' },
];
const taxes = [
  { key: 'icmsRecoveryPct', label: 'ICMS' },
  { key: 'ipiRecoveryPct', label: 'IPI' },
  { key: 'pisRecoveryPct', label: 'PIS' },
  { key: 'cofinsRecoveryPct', label: 'Cofins' },
] as const;

const emptyMatrix = (): TcoAssumption[] => uses.map(use => ({
  itemUseType: use.key,
  icmsRecoveryPct: 0,
  ipiRecoveryPct: 0,
  pisRecoveryPct: 0,
  cofinsRecoveryPct: 0,
}));

export const TaxSettingsModal: React.FC<TaxSettingsModalProps> = ({ isOpen, onClose }) => {
  const [matrix, setMatrix] = useState<TcoAssumption[]>(emptyMatrix);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    fetch(`${API_BASE_URL}/companies/tco-assumptions`)
      .then(async response => {
        if (!response.ok) throw new Error('Não foi possível carregar as premissas.');
        return response.json();
      })
      .then(setMatrix)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Erro ao carregar.'));
  }, [isOpen]);

  const change = (itemUseType: ItemUseType, field: typeof taxes[number]['key'], value: string) => {
    const percentage = Math.min(100, Math.max(0, Number(value) || 0));
    setMatrix(current => current.map(row => row.itemUseType === itemUseType ? { ...row, [field]: percentage } : row));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/companies/tco-assumptions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matrix),
      });
      if (!response.ok) throw new Error('Não foi possível salvar as premissas.');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-8 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-800">Premissas de TCO</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Percentual estimado de recuperação por destinação</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-rose-500" aria-label="Fechar"><X className="w-6 h-6" /></button>
        </div>

        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-6 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-xs font-semibold text-blue-800 leading-relaxed">
            Estas são premissas comerciais para comparar fornecedores. O sistema aplica o percentual ao valor do tributo informado na cotação ou na nota.
          </p>
        </div>

        <form onSubmit={save}>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                <tr><th className="p-4">Destinação</th>{taxes.map(tax => <th key={tax.key} className="p-4">{tax.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uses.map(use => {
                  const row = matrix.find(item => item.itemUseType === use.key) || emptyMatrix().find(item => item.itemUseType === use.key)!;
                  return (
                    <tr key={use.key}>
                      <td className="p-4 text-sm font-bold text-slate-700">{use.label}</td>
                      {taxes.map(tax => (
                        <td key={tax.key} className="p-3">
                          <div className="relative min-w-24">
                            <input type="number" min="0" max="100" step="0.01" value={row[tax.key]} onChange={event => change(use.key, tax.key, event.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2 pr-8 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                            <Percent className="absolute right-2 top-2.5 h-4 w-4 text-slate-300" />
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && <p className="mt-4 text-sm font-bold text-rose-600">{error}</p>}
          <div className="pt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold text-xs rounded-2xl">Cancelar</button>
            <button disabled={loading} type="submit" className="px-7 py-3 bg-blue-600 text-white font-bold text-xs rounded-2xl flex items-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" />{loading ? 'Salvando...' : 'Salvar premissas'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
