import React, { useState, useEffect } from 'react';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  icon?: React.ReactNode;
  color?: string;
  prefix?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ label, value, onChange, icon, color = "blue", prefix = "R$" }) => {
  // Estado de string para permitir formatação visual fluida
  const [displayValue, setDisplayValue] = useState("");

  // Formata o número para o padrão brasileiro: 1500.5 -> 1.500,50
  const formatValue = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Quando o valor vem de fora (ex: trocou de aba), atualizamos o display
  useEffect(() => {
    if (value === 0 && displayValue === "") return;
    setDisplayValue(formatValue(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    
    // Converte para decimal (centavos)
    const numericValue = Number(raw) / 100;
    
    // Atualiza o estado visual formatado
    setDisplayValue(formatValue(numericValue));
    
    // Notifica o pai sobre o valor numérico real
    onChange(numericValue);
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
        {icon} {label}
      </label>
      <div className="relative group transition-all duration-300">
        <div className={`absolute inset-0 bg-slate-50 rounded-2xl group-focus-within:bg-white group-focus-within:ring-2 group-focus-within:ring-${color}-500/20 transition-all shadow-inner border border-slate-100`}></div>
        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-${color}-600/50 z-10`}>{prefix}</span>
        <input 
          type="text"
          className={`relative w-full bg-transparent border-2 border-transparent focus:border-${color}-500 rounded-2xl pl-10 pr-4 py-3.5 text-sm font-black text-slate-700 outline-none transition-all z-10`}
          value={displayValue}
          onChange={handleChange}
          onFocus={(e) => e.target.select()} // Seleciona tudo ao clicar para facilitar
        />
      </div>
    </div>
  );
};