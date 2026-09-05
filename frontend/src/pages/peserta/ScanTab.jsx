import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Info } from "lucide-react";
import { toast } from "sonner";
import QrScanner from "@/components/QrScanner";

// Extract absen token from a scanned string that may be a full URL like
// https://host/absen/<token>  or just a token.
function extractAbsenToken(text) {
  if (!text) return null;
  const m = text.match(/\/absen\/([^/?#\s]+)/);
  if (m) return m[1];
  if (text.startsWith("EKP:")) return null; // personal QR, not a kegiatan QR
  return null;
}

export default function ScanTab() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  const onDetected = (text) => {
    if (done) return;
    const token = extractAbsenToken(text);
    if (token) {
      setDone(true);
      toast.success("QR kegiatan terdeteksi");
      navigate(`/absen/${token}`);
    } else {
      toast.error("QR ini bukan barcode kegiatan absensi");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#111827]">Scan Absensi</h1>
      <p className="text-sm text-[#6B7280] flex items-center gap-2"><ScanLine size={16} className="text-[#0D5C3A]" /> Arahkan kamera ke QR kegiatan yang disediakan pengurus untuk absen sendiri.</p>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
        <QrScanner onDetected={onDetected} paused={done} />
      </div>

      <div className="bg-[#F0FAF4] border border-[#BBF7D0] rounded-2xl p-4 text-sm text-[#065F46] flex gap-2">
        <Info size={18} className="shrink-0 mt-0.5" />
        <span>Setelah QR terbaca, Anda akan diarahkan ke halaman absen untuk konfirmasi kehadiran. Pastikan kegiatan masih berlangsung.</span>
      </div>
    </div>
  );
}
