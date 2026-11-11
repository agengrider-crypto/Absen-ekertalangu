// Bagikan laporan banyak peserta (Layar: "Bagikan banyak daftar tautan atau satu tautan").
// Dua pilihan: satu tautan per peserta (digabung dalam satu pesan) atau satu tautan
// yang membuka daftar semua peserta terpilih.
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function monthLabel(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month) return "";
  return `${MONTHS[month - 1]} ${year}`;
}

function expiryLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function ShareManyLinksModal({ rows = [], month, week = "bulanan", onClose }) {
  const [mode, setMode] = useState("per-peserta");
  const [links, setLinks] = useState(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);

  const periodLabel = week === "bulanan" ? monthLabel(month) : `${monthLabel(month)} · Pekan ${week}`;

  useEffect(() => {
    let alive = true;
    setLinks(null);
    setError("");
    api.post("/admin/laporan/peserta/share-banyak", {
      user_ids: rows.map((r) => r.user_id),
      month,
      week,
    })
      .then(({ data }) => {
        if (!alive) return;
        setLinks(data.links || []);
        setExpiresAt(data.expires_at || "");
      })
      .catch((e) => {
        if (!alive) return;
        setError(formatApiErrorDetail(e.response?.data?.detail));
        setLinks([]);
      });
    return () => { alive = false; };
  }, [rows, month, week]);

  const message = useMemo(() => {
    if (!links || !links.length) return "";
    const head = `Berikut laporan kehadiran ${periodLabel}:`;
    if (mode === "satu-tautan") {
      return `${head}\n${links[0].link}`;
    }
    return `${head}\n\n${links.map((l) => `${l.name}\n${l.link}`).join("\n\n")}`;
  }, [links, mode, periodLabel]);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
      toast.success("Disalin.");
    } catch {
      toast.error("Gagal menyalin. Salin manual dari kotak pesan.");
    }
  };

  const shareWa = () => {
    if (!message) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const loading = links === null;

  return (
    <Modal
      onClose={onClose}
      title="Bagikan laporan banyak peserta"
      subtitle={`${rows.length} peserta dipilih · ${periodLabel}`}
      testid="share-many-modal"
      maxWidth={960}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[#5F6B63]">
            {expiresAt ? `Semua tautan berlaku sampai ${expiryLabel(expiresAt)}.` : "Tautan dibuat otomatis saat modal dibuka."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(message, "pesan")} disabled={loading || !message}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-50">
              {copied === "pesan" ? <Check size={16} /> : <Copy size={16} />} Salin semua pesan
            </button>
            <button type="button" onClick={shareWa} disabled={loading || !message}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0B6B52] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-50">
              <Send size={16} /> Bagikan ke pengurus
            </button>
          </div>
        </div>
      )}
    >
      {error ? (
        <div className="rounded-2xl border border-[#FBE5E3] bg-[#FBE5E3] p-4 text-sm text-[#A32A2A]">{error}</div>
      ) : (
        <>
          {/* Pilihan mode */}
          <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    key: "per-peserta",
                    icon: Link2,
                    title: "Daftar tautan",
                    badge: "Disarankan",
                    desc: "Satu tautan untuk setiap peserta, digabung dalam satu pesan. Setiap tautan hanya membuka laporan satu orang.",
                  },
                  {
                    key: "satu-tautan",
                    icon: Users,
                    title: "Satu tautan semua",
                    desc: "Satu tautan yang membuka daftar semua peserta. Praktis, tapi siapa pun yang memegangnya bisa melihat semuanya.",
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const on = mode === opt.key;
                  return (
                    <button key={opt.key} type="button" onClick={() => setMode(opt.key)}
                      aria-pressed={on} data-testid={`share-many-mode-${opt.key}`}
                      className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${
                        on ? "border-[#14633F] bg-[#E3F3EA]" : "border-[#E7E3D8] bg-white hover:border-[#8A948D]"
                      }`}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        on ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#5F6B63]"
                      }`}>
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[15px] font-bold text-[#14201A]">{opt.title}</span>
                          {opt.badge && (
                            <span className="rounded-full bg-[#FBF1D6] px-2 py-0.5 text-[11px] font-bold text-[#6B4500]">
                              {opt.badge}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-[#5F6B63]">{opt.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {/* Daftar tautan */}
                <section className="min-w-0">
                  <h3 className="mb-2 text-[13px] font-bold text-[#14201A]">
                    {mode === "satu-tautan" ? "Tautan semua peserta" : "Tautan tiap peserta"}
                  </h3>
                  {loading ? (
                    <div className="flex items-center gap-2 rounded-xl bg-[#F6F4EE] p-4 text-sm text-[#5F6B63]">
                      <Loader2 size={16} className="animate-spin" /> Membuat tautan…
                    </div>
                  ) : (
                    <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {(mode === "satu-tautan" ? links.slice(0, 1) : links).map((l) => (
                        <li key={l.user_id || l.link}
                          className="flex items-center gap-2 rounded-xl border border-[#E7E3D8] px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-[#14201A]">{l.name}</div>
                            <div className="truncate text-[11px] text-[#5F6B63]">{l.link}</div>
                          </div>
                          <button type="button" onClick={() => copy(l.link, l.user_id || l.link)}
                            aria-label={`Salin tautan ${l.name}`}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">
                            {copied === (l.user_id || l.link) ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Pratinjau pesan */}
                <section className="min-w-0">
                  <h3 className="mb-2 text-[13px] font-bold text-[#14201A]">Pesan yang akan dikirim</h3>
                  <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#E9F5EE] p-3 text-[12.5px] leading-relaxed text-[#14201A]"
                    data-testid="share-many-message">
                    {loading ? "Menyiapkan pesan…" : message}
                  </div>
                </section>
              </div>
        </>
      )}
    </Modal>
  );
}
