import { MockWindowProps, NotifProps, ScenarioCardProps } from "./types";

export const MockWindow = ({ title, children }: MockWindowProps) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
    <div className="bg-neutral-950 px-4 py-3 flex items-center gap-2 border-b border-neutral-900">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
      <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
      <span className="font-mono text-xs text-neutral-600 mx-auto pr-6">{title}</span>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

export const NotifMock = ({ from, time, subject, body, link, accent = "emerald" }: NotifProps) => {
  const isYellow = accent === "yellow";
  return (
    <div className={`bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden mb-2.5 border-l-2 ${isYellow ? "border-l-yellow-400" : "border-l-emerald-400"}`}>
      <div className="px-4 py-3 border-b border-neutral-900 flex justify-between items-center">
        <span className="font-mono text-xs text-neutral-600">{from}</span>
        <span className="font-mono text-xs text-neutral-700">{time}</span>
      </div>
      <div className="px-4 pt-3 pb-1 font-bold text-sm text-white leading-tight">{subject}</div>
      <div className="px-4 pb-3 text-xs text-neutral-600 leading-relaxed">{body}</div>
      <div className={`mx-4 mb-4 inline-block font-mono text-xs border px-3 py-1.5 rounded ${isYellow ? "text-yellow-400 border-yellow-400/20" : "text-emerald-400 border-emerald-400/20"}`}>
        {link}
      </div>
    </div>
  );
};

export const ScenarioCard = ({ icon, title, desc }: ScenarioCardProps) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-colors">
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="text-lg">{icon}</span>
      <span className="font-bold text-sm tracking-tight">{title}</span>
    </div>
    <div className="text-xs text-neutral-500 leading-relaxed px-5 pb-4 border-t border-neutral-800/60 pt-3">
      {desc}
    </div>
  </div>
);