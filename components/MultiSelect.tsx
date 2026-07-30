import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<Props> = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

  const names = selected.map(id => options.find(o => o.id === id)?.name).filter(Boolean);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded border border-gray-200 bg-white text-left text-xs min-h-[30px] hover:border-indigo-300"
      >
        <div className="flex flex-wrap gap-1">
          {names.length === 0 && <span className="text-gray-400">{placeholder || '選択'}</span>}
          {names.map((n, i) => (
            <span key={i} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[11px]">{n}</span>
          ))}
        </div>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-56 max-h-56 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.length === 0 && <div className="px-3 py-1.5 text-xs text-gray-400">候補がありません</div>}
          {options.map(o => (
            <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="accent-indigo-600" />
              <span>{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
