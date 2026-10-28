import { Sprout } from "lucide-react";

export function MotivationCard({ text }: { text: string }) {
  if (!text) return null;
  return (
    <section className="relative flex h-full flex-col justify-between overflow-hidden rounded-[22px] border border-[#dfe9d6] bg-gradient-to-br from-[#e9f1e0] via-[#f1f6e9] to-[#e4eede] p-5">
      <p className="relative z-10 text-[12.5px] leading-relaxed text-[#3f5a48]">{text}</p>
      <div className="relative z-10 mt-3 flex items-center gap-1.5 text-[11px] text-[#6c7f70]">
        <Sprout size={12} aria-hidden />
        每天一点点，身体会记得
      </div>
      <Sprout size={90} className="pointer-events-none absolute -bottom-8 -right-4 text-[#cfe0c2]/70" aria-hidden />
    </section>
  );
}
