// Pusat Bantuan: Tutorial (satu langkah per layar) / Tanya Jawab / Hubungi.
// Isi per peran ada di src/lib/helpContent.js. Tanpa video (video ada di menu
// sidebar "Tutorial video").
import { useEffect, useMemo, useState } from "react";
import {
  LifeBuoy, BookOpen, MessageCircleQuestion, PhoneCall, ChevronDown, ChevronLeft,
  ChevronRight, Loader2, Send, Mail, Search, ShieldCheck, Users, UserCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { HELP_CONTENT, HELP_ROLES } from "@/lib/helpContent";

const ROLE_ICON = { admin: ShieldCheck, pengurus: Users, peserta: UserCheck };

export default function BantuanView({ role = "admin" }) {
  const available = useMemo(() => {
    if (role === "admin") return HELP_ROLES;
    return HELP_ROLES.filter((r) => r.key === role);
  }, [role]);
  const [pick, setPick] = useState(available[0]?.key || "peserta");
  const [tab, setTab] = useState("tutorial");
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [kontak, setKontak] = useState(null);

  useEffect(() => {
    if (!available.some((r) => r.key === pick)) setPick(available[0]?.key || "peserta");
  }, [available, pick]);

  useEffect(() => {
    api.get("/bantuan/kontak").then(({ data }) => setKontak(data.items || [])).catch(() => setKontak([]));
  }, []);

  const content = HELP_CONTENT[pick] || HELP_CONTENT.peserta;
  const term = q.trim().toLowerCase();
  const steps = term
    ? content.steps.filter((s) => `${s.title} ${s.desc}`.toLowerCase().includes(term))
    : content.steps;
  const faqs = term
    ? content.faq.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(term))
    : content.faq;
  const current = steps[Math.min(step, Math.max(steps.length - 1, 0))];

  return (
    <div className="space-y-4" data-testid="bantuan-view">
      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5 sm:p-6">
        <div className="font-heading text-xl font-bold text-[#14201A] inline-flex items-center gap-2 sm:text-2xl">
          <LifeBuoy size={22} /> Pusat Bantuan
        </div>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5F6B63]">
          Panduan singkat sesuai peran Anda, tanya jawab, dan kontak pengurus.
        </p>
        {available.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((r) => {
              const Icon = ROLE_ICON[r.key] || Users;
              const on = pick === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  data-testid={`bantuan-role-${r.key}`}
                  onClick={() => { setPick(r.key); setStep(0); }}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border-2 px-3.5 text-sm font-semibold transition-colors ${
                    on ? "border-transparent bg-[#14633F] text-white" : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
                  }`}
                >
                  <Icon size={15} /> {r.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#F0EEE6] p-1">
          {[
            ["tutorial", "Tutorial", BookOpen],
            ["faq", "Tanya Jawab", MessageCircleQuestion],
            ["kontak", "Hubungi", PhoneCall],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              data-testid={`bantuan-tab-${key}`}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === key ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          <input
            data-testid="bantuan-search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setStep(0); }}
            placeholder="Cari panduan atau pertanyaan…"
            className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-9 pr-3 text-base outline-none focus:border-[#14633F]"
          />
        </div>

        {tab === "tutorial" && (
          <div className="mt-4" data-testid="bantuan-tutorial">
            {!current ? (
              <p className="py-8 text-center text-sm text-[#5F6B63]">Tidak ada langkah yang cocok.</p>
            ) : (
              <>
                <div className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">
                    Langkah {Math.min(step, steps.length - 1) + 1} dari {steps.length}
                  </div>
                  <div className="mt-1.5 font-heading text-base font-bold text-[#14201A]">{current.title}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5F6B63]">{current.desc}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="bantuan-step-prev"
                    onClick={() => setStep((v) => Math.max(0, v - 1))}
                    disabled={step <= 0}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-[#E7E3D8] px-3.5 text-sm font-semibold text-[#5F6B63] hover:border-[#14633F] disabled:opacity-40"
                  >
                    <ChevronLeft size={16} /> Sebelumnya
                  </button>
                  <button
                    type="button"
                    data-testid="bantuan-step-next"
                    onClick={() => setStep((v) => Math.min(steps.length - 1, v + 1))}
                    disabled={step >= steps.length - 1}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0B6B52] px-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                  >
                    Berikutnya <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "faq" && (
          <div className="mt-4 divide-y divide-[#E7E3D8] overflow-hidden rounded-xl border border-[#E7E3D8]" data-testid="bantuan-faq">
            {faqs.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#5F6B63]">Tidak ada pertanyaan yang cocok.</p>
            ) : faqs.map((f, i) => {
              const on = openFaq === i;
              return (
                <div key={i}>
                  <button
                    type="button"
                    data-testid={`bantuan-faq-${i}`}
                    onClick={() => setOpenFaq(on ? null : i)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left ${on ? "bg-[#F0EEE6]" : "hover:bg-[#F6F4EE]"}`}
                  >
                    <span className="text-sm font-semibold text-[#14201A]">{f.q}</span>
                    <ChevronDown size={17} className={`mt-0.5 shrink-0 text-[#5F6B63] transition-transform ${on ? "rotate-180" : ""}`} />
                  </button>
                  {on && <p className="px-4 pb-3.5 text-sm leading-relaxed text-[#5F6B63]">{f.a}</p>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "kontak" && (
          <div className="mt-4" data-testid="bantuan-kontak">
            <p className="text-xs text-[#5F6B63]">Daftar diambil otomatis dari akun admin &amp; pengurus yang aktif.</p>
            {kontak === null ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
            ) : kontak.length === 0 ? (
              <p className="mt-3 text-sm text-[#5F6B63]">Belum ada kontak pengurus yang tercatat.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {kontak.map((k) => (
                  <div key={k.id} className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">{k.role}</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#14201A]">{k.name}</div>
                    <div className="mt-0.5 text-xs text-[#5F6B63]">{k.phone || k.whatsapp || "Nomor belum diisi"}</div>
                    <div className="mt-2.5 flex gap-2">
                      {k.wa_link && (
                        <a href={k.wa_link} target="_blank" rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#14633F] px-3 text-xs font-semibold text-white hover:brightness-95">
                          <Send size={13} /> WhatsApp
                        </a>
                      )}
                      {k.phone && (
                        <a href={`tel:${k.phone}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-[#14633F] px-3 text-xs font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
                          <PhoneCall size={13} /> Telepon
                        </a>
                      )}
                      {k.email && (
                        <a href={`mailto:${k.email}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">
                          <Mail size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
