import { Sparkles } from "lucide-react";

export default function ComingSoon({ title, message }) {
  return (
    <div className="bg-white rounded-2xl p-10 border border-[#E7E3D8] text-center" data-testid="coming-soon">
      <div className="inline-flex items-center gap-2 bg-[#E3F3EA] text-[#0E4E31] px-3 py-1 rounded-full text-sm font-semibold mb-4">
        <Sparkles size={16} /> Segera Hadir
      </div>
      <h2 className="font-heading text-xl font-bold text-[#14201A] mb-2">{title}</h2>
      <p className="text-[#5F6B63] max-w-xl mx-auto">{message}</p>
    </div>
  );
}
