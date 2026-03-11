import { UseSectionProps } from "./types";
import { ScenarioCard } from "./ui";
import { Reveal } from "./reveal";

export const UseSection = ({
  tag,
  title,
  intro,
  scenarios,
  visual,
  flip = false,
  dark = false,
}: UseSectionProps) => {
  const content = (
    <>
      {/* Coluna de texto */}
      <Reveal>
        <div className="inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase px-3 py-1.5 rounded-full border border-emerald-400/25 text-emerald-400 bg-emerald-400/5 mb-6">
          {tag}
        </div>
        <h2 className="text-5xl font-black tracking-tighter leading-[0.92] mb-6">{title}</h2>
        <p className="text-base text-neutral-500 leading-relaxed font-light mb-10">{intro}</p>
        <div className="flex flex-col gap-3">
          {scenarios.map((s) => (
            <ScenarioCard key={s.title} {...s} />
          ))}
        </div>
      </Reveal>

      {/* Coluna visual */}
      <Reveal delay={0.15}>{visual}</Reveal>
    </>
  );

  return (
    <section className={`px-16 py-24 border-b border-neutral-900 ${dark ? "bg-[#0c0c0c]" : ""}`}>
      <div className={`grid grid-cols-2 gap-24 items-start ${flip ? "direction-rtl" : ""}`}>
        {flip ? (
          <>
            <Reveal delay={0.15}>{visual}</Reveal>
            <Reveal>
              <div className="inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase px-3 py-1.5 rounded-full border border-emerald-400/25 text-emerald-400 bg-emerald-400/5 mb-6">
                {tag}
              </div>
              <h2 className="text-5xl font-black tracking-tighter leading-[0.92] mb-6">{title}</h2>
              <p className="text-base text-neutral-500 leading-relaxed font-light mb-10">{intro}</p>
              <div className="flex flex-col gap-3">
                {scenarios.map((s) => (
                  <ScenarioCard key={s.title} {...s} />
                ))}
              </div>
            </Reveal>
          </>
        ) : (
          content
        )}
      </div>
    </section>
  );
};