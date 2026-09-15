import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Info, UserCheck } from "lucide-react";
import { toast } from "sonner";
import QrScanner from "@/components/QrScanner";

// Ambil token absen dari hasil scan, baik berupa URL lengkap
// (https://host/absen/<token>) maupun token mentah.
function extractAbsenToken(text) {
  if (!text) return null;
  const m = text.match(/\/absen\/([^/?#\s]+)/);
  if (m) return m[1];
  return null;
}

export default function ScanTab() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  const onDetected = (text) => {
    if (done) return;
    const publik = text && text.match(/\/hadir\/([^/?#\s]+)/);
    if (publik) {
      setDone(true);
      toast.success("QR kegiatan terbaca. Mohon tunggu sebentar...");
      navigate(`/hadir/${publik[1]}`);
      return;
    }
    const token = extractAbsenToken(text);
    if (token) {
      setDone(true);
      toast.success("QR kegiatan terbaca. Mohon tunggu sebentar...");
      navigate(`/absen/${token}`);
      return;
    }
    if (text && text.startsWith("EKP:")) {
      toast.error("Mohon maaf, ini QR pribadi Anda sendiri. Mohon scan QR kegiatan yang disediakan pengurus.");
      return;
    }
    toast.error("Mohon maaf, QR ini bukan QR kegiatan absensi. Mohon scan QR yang disediakan pengurus.");
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#111827]">Scan Absensi</h1>
      <p className="text-sm text-[#6B7280] flex items-start gap-2">
        <ScanLine size={16} className="text-[#0D5C3A] shrink-0 mt-0.5" />
        Arahkan kamera ke QR kegiatan yang disediakan pengurus untuk mencatat kehadiran Anda.
      </p>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
        <QrScanner onDetected={onDetected} paused={done} />
      </div>

      <div className="bg-[#F0FAF4] border border-[#BBF7D0] rounded-2xl p-4 text-sm text-[#065F46] flex gap-2.5">
        <UserCheck size={18} className="shrink-0 mt-0.5" />
        <span>
          Absen ini <b>hanya untuk diri Anda sendiri</b>. Setelah QR terbaca, kehadiran Anda
          <b> langsung tercatat otomatis</b> tanpa perlu menekan tombol apa pun.
        </span>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 text-sm text-[#4B5563] flex gap-2.5">
        <Info size={18} className="shrink-0 mt-0.5 text-[#9CA3AF]" />
        <span>Pastikan kegiatan masih berlangsung. Bila sudah ditutup, mohon menghubungi pengurus untuk absen susulan.</span>
      </div>
    </div>
  );
}
