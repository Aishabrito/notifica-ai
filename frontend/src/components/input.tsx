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
  <div className="flex flex-col gap-1">
    {label && (
      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">
        {label}
      </label>
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full bg-black border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400 transition-all font-mono text-sm"
    />
  </div>
);