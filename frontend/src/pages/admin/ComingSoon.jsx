import { Sparkles } from "lucide-react";

export default function ComingSoon({ title, message }) {
  return (
    <div className="bg-white rounded-2xl p-10 border border-[#E5E7EB] text-center" data-testid="coming-soon">
      <div className="inline-flex items-center gap-2 bg-[#E8F5EE] text-[#065F46] px-3 py-1 rounded-full text-sm font-semibold mb-4">
        <Sparkles size={16} /> Segera Hadir
      </div>
      <h2 className="font-heading text-xl font-bold text-[#111827] mb-2">{title}</h2>
      <p className="text-[#6B7280] max-w-xl mx-auto">{message}</p>
    </div>
  );
}
