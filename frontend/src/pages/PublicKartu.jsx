// Halaman publik kartu peserta (tanpa login). Hanya nama, kategori, dan QR permanen.
// noindex + Referrer-Policy no-referrer dipasang lewat header server & meta.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

export default function PublicKartu() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const cardRef = useRef(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const ref = document.createElement("meta");
    ref.name = "referrer";
    ref.content = "no-referrer";
    document.head.appendChild(ref);
    return () => {
      document.head.removeChild(meta);
      document.head.removeChild(ref);
    };
  }, []);

  useEffect(() => {
    api.get(`/publik/kartu/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan tidak berlaku."))
      .finally(() => setLoading(false));
  }, [token]);

  // Simpan gambar: render SVG kartu ke canvas lalu unduh PNG.
  const simpanGambar = () => {
    try {
      const svg = cardRef.current?.querySelector("svg");
      if (!svg) return;
      const teks = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `kartu-${(data?.nama || "peserta").replace(/\s+/g, "_")}.png`;
        document.body.appendChild(a); a.click(); a.remove();
      };
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(teks)))}`;
    } catch (_) { /* peramban tidak mendukung */ }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F4EE]">
        <Loader2 className="animate-spin text-[#0E4E31] motion-reduce:animate-none" size={28} />
      </div>
    );
  }

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-4 text-center">
        <Logo size={48} />
        <p className="mt-6 max-w-sm text-sm font-semibold text-[#A32A2A]">{err}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-3 text-lg font-bold text-[#14201A]">Kartu peserta</h1>
        </div>

        <div ref={cardRef} className="mt-5 rounded-2xl border border-[#E7E3D8] bg-white p-5 text-center">
          <p className="text-[11px] font-semibold tracking-wide text-[#5F6B63]">E-Kertalangu</p>
          <p className="mt-2 break-words text-lg font-bold text-[#14201A]">{data?.nama}</p>
          {data?.kategori && (
            <span className="mt-2 inline-block rounded-full border border-[#8A948D] px-3 py-0.5 text-xs text-[#14201A]">
              {data.kategori}
            </span>
          )}
          <div className="mt-4 flex justify-center">
            <QRCodeSVG value={data?.qr || ""} size={200} level="M" fgColor="#000000" bgColor="#FFFFFF" />
          </div>
          <p className="mt-3 text-xs text-[#5F6B63]">Tunjukkan ke kamera saat absen</p>
        </div>

        <button
          type="button"
          onClick={simpanGambar}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-base font-semibold text-white hover:bg-[#0E4E31]"
        >
          <Download size={17} /> Simpan gambar
        </button>
      </div>
    </div>
  );
}
