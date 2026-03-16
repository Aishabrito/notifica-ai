interface InputProps {
  type?: string;
  placeholder?: string;
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

export const Input = ({
  type = "text",
  placeholder,
  label,
  value,
  onChange,
  required,
}: InputProps) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
        {label}
      </label>
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full bg-black border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400 focus:border-purple-500/50 transition-all font-mono text-sm text-[#f5f2eb] placeholder:text-neutral-700"
      style={{
        WebkitTextFillColor: '#f5f2eb',
        boxShadow: '0 0 0px 1000px black inset',
      }}
    />
  </div>
);