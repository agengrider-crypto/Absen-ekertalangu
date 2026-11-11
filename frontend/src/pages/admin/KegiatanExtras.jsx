import { useEffect, useState } from "react";
import {
  Loader2, Copy, Send, Users, ShieldCheck, Trash2,
  CheckCircle2, ScanLine, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import QrScanner from "@/components/QrScanner";
import Modal from "@/components/Modal";

function ModalShell({ title, children, onClose, testid, wide }) {
  return (
    <Modal
      onClose={onClose}
      title={title}
      testid={testid}
      maxWidth={wide ? 960 : 640}
      bodyClassName="p-5"
    >
      {children}
    </Modal>
  );
}

/* ------------------------- Pengingat WA ------------------------- */
export function ReminderModal({ kegiatan, onClose }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState([]);
  const MAX = 5;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/staff/kegiatan/${kegiatan.id}/reminder`);
        setData(data);
        setText(data.text || "");
      } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    })();
  }, [kegiatan.id]);

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) { toast.error(`Maksimal ${MAX} penerima per sesi`); return prev; }
      return [...prev, id];
    });
  };

  const waLink = (wa) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  const copyText = () => { navigator.clipboard.writeText(text); toast.success("Teks disalin"); };

  const recipients = data?.recipients || [];
  const chosen = recipients.filter((r) => selected.includes(r.id));

  return (
    <ModalShell title="Pengingat via WhatsApp" onClose={onClose} testid="modal-reminder-wa" wide>
      {data === null ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#FBF1D6] border border-[#EAD596] rounded-xl p-3 text-sm text-[#6B4500] flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>Jalur gratis lewat <b>wa.me</b>. Pilih hingga {MAX} penerima, teks otomatis terisi, lalu tap kirim di tiap chat. Pengiriman massal otomatis butuh WhatsApp Business API berbayar (belum dipakai).</span>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#14201A]">Teks pesan</label>
            <textarea
              data-testid="reminder-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] resize-none"
            />
            <button onClick={copyText} className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E7E3D8] text-[#5F6B63] font-semibold text-sm hover:border-[#14633F] hover:text-[#0E4E31]"><Copy size={15} /> Salin Teks</button>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#14201A]">Penerima ({selected.length}/{MAX})</label>
              <span className="text-xs text-[#5F6B63]">{recipients.length} peserta punya nomor</span>
            </div>
            {recipients.length === 0 ? (
              <p className="text-sm text-[#5F6B63] mt-2">Belum ada peserta dengan nomor WhatsApp/HP.</p>
            ) : (
              <div className="mt-1.5 max-h-52 overflow-y-auto border border-[#E7E3D8] rounded-xl divide-y divide-[#F0EEE6]">
                {recipients.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F6F4EE]">
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[#14633F]" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#14201A] truncate">{r.name}</div>
                      <div className="text-xs text-[#5F6B63]">{r.phone}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {chosen.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[#14201A]">Kirim per chat:</div>
              {chosen.map((r) => (
                <a
                  key={r.id}
                  data-testid={`reminder-send-${r.id}`}
                  href={waLink(r.wa)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between gap-2 h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold text-sm hover:bg-[#0E4E31]"
                >
                  <span className="truncate">Kirim ke {r.name}</span>
                  <Send size={16} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

/* ------------------------- Delegasi Absensi ------------------------- */
export function DelegasiModal({ kegiatan, onClose }) {
  const [peserta, setPeserta] = useState(null);
  const [delegs, setDelegs] = useState([]);
  const [granteeId, setGranteeId] = useState("");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [rekap, dl] = await Promise.all([
        api.get(`/admin/kegiatan/${kegiatan.id}/rekap`),
        api.get(`/staff/kegiatan/${kegiatan.id}/delegations`),
      ]);
      setPeserta(rekap.data.rows || []);
      setDelegs(dl.data || []);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kegiatan.id]);

  const submit = async () => {
    if (!granteeId) { toast.error("Pilih penerima delegasi"); return; }
    setSaving(true);
    try {
      await api.post(`/staff/kegiatan/${kegiatan.id}/delegate`, { grantee_id: granteeId, reason: reason.trim() });
      toast.success("Delegasi diberikan");
      setGranteeId(""); setReason(""); setQ("");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  const revoke = async (id) => {
    try {
      await api.post(`/staff/delegation/${id}/revoke`);
      toast.success("Delegasi dicabut");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const filtered = (peserta || []).filter((p) => p.name?.toLowerCase().includes(q.toLowerCase()));
  const active = delegs.filter((d) => d.active);
  const history = delegs.filter((d) => !d.active);

  return (
    <ModalShell title="Delegasi Penjaga Absensi" onClose={onClose} testid="modal-delegasi" wide>
      <div className="space-y-5">
        <div className="bg-[#E3F3EA] border border-[#E3EEFB] rounded-xl p-3 text-sm text-[#1D4F91]">
          Serahkan hak pengisian absen ke orang terpilih saat Anda tidak di lokasi. Hak berlaku sementara & <b>otomatis dicabut saat kegiatan ditutup/selesai</b>. Semua tercatat di Log audit.
        </div>

        {kegiatan.status !== "open" ? (
          <div className="text-sm text-[#A32A2A] bg-[#FBE5E3] rounded-xl p-3">Kegiatan sudah ditutup — delegasi baru dinonaktifkan.</div>
        ) : (
          <div className="border border-[#E7E3D8] rounded-2xl p-4 space-y-3">
            <div className="font-semibold text-[#14201A] text-sm flex items-center gap-2"><Users size={16} className="text-[#0E4E31]" /> Beri delegasi baru</div>
            <input
              data-testid="delegasi-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama peserta…"
              className="w-full h-11 px-3.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F]"
            />
            {peserta === null ? (
              <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-[#E7E3D8] rounded-xl divide-y divide-[#F0EEE6]">
                {filtered.map((p) => (
                  <button
                    key={p.user_id}
                    data-testid={`delegasi-pick-${p.user_id}`}
                    onClick={() => setGranteeId(p.user_id)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between ${granteeId === p.user_id ? "bg-[#E3F3EA] text-[#0E4E31] font-semibold" : "hover:bg-[#F6F4EE] text-[#14201A]"}`}
                  >
                    {p.name}
                    {granteeId === p.user_id && <CheckCircle2 size={16} className="text-[#0E4E31]" />}
                  </button>
                ))}
                {filtered.length === 0 && <div className="px-3 py-4 text-sm text-[#5F6B63] text-center">Tidak ada hasil.</div>}
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-[#14201A]">Catatan alasan (opsional)</label>
              <textarea
                data-testid="delegasi-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Mis. Pengurus sedang tidak di lokasi kegiatan."
                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] resize-none"
              />
            </div>
            <button
              data-testid="delegasi-submit"
              onClick={submit}
              disabled={saving}
              className="w-full h-11 rounded-xl bg-[#14633F] text-white font-semibold text-sm hover:bg-[#0E4E31] disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Berikan Delegasi
            </button>
          </div>
        )}

        {active.length > 0 && (
          <div>
            <div className="font-semibold text-[#14201A] text-sm mb-2">Delegasi aktif</div>
            <div className="space-y-2">
              {active.map((d) => (
                <div key={d.id} className="border border-[#E7E3D8] bg-[#E3F3EA] rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold text-[#0E4E31]">{d.grantee_name}</div>
                    <div className="text-[#5F6B63]">Alasan: {d.reason}</div>
                    <div className="text-xs text-[#5F6B63] mt-0.5">Oleh {d.granted_by} · {d.created_at?.slice(0, 16).replace("T", " ")}</div>
                  </div>
                  <button data-testid={`delegasi-revoke-${d.id}`} onClick={() => revoke(d.id)} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#A32A2A] text-[#A32A2A] font-semibold text-xs hover:bg-[#FBE5E3]"><Trash2 size={14} /> Cabut</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div className="font-semibold text-[#14201A] text-sm mb-2">Riwayat (audit)</div>
            <div className="space-y-1.5">
              {history.map((d) => (
                <div key={d.id} className="border border-[#E7E3D8] rounded-lg p-2.5 text-xs text-[#5F6B63]">
                  <span className="font-medium text-[#14201A]">{d.grantee_name}</span> — {d.reason}. Diberi oleh {d.granted_by}. Dicabut: {d.revoked_reason || "-"}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ------------------------- Scan QR Peserta (absen dibantu) ------------------------- */
export function ScanPesertaModal({ kegiatan, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  const onDetected = async (text) => {
    if (busy) return;
    if (!text || !text.startsWith("EKP:")) {
      toast.error("Mohon maaf, QR ini bukan QR pribadi peserta. Mohon peserta membuka menu “QR Saya”.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/staff/kegiatan/${kegiatan.id}/scan-personal`, { content: text });
      setLast(data);
      if (data.already) toast.info(data.message || `${data.name} sudah tercatat hadir sebelumnya.`);
      else toast.success(data.message || `Alhamdulillah, kehadiran ${data.name} berhasil dicatat.`);
      onChanged?.();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setTimeout(() => setBusy(false), 1200);
  };

  return (
    <ModalShell title="Absen Scan Barcode" onClose={onClose} testid="modal-scan-peserta">
      {kegiatan.status !== "open" ? (
        <div className="text-sm text-[#A32A2A] bg-[#FBE5E3] rounded-xl p-3">
          Mohon maaf, kegiatan ini sudah ditutup sehingga scan absen dinonaktifkan.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[#5F6B63] flex items-start gap-2">
            <ScanLine size={16} className="text-[#0E4E31] shrink-0 mt-0.5" />
            Arahkan kamera ke <b>QR pribadi peserta</b> (menu “QR Saya” pada akun peserta) untuk menandai hadir.
          </p>
          <QrScanner onDetected={onDetected} paused={busy} />
          {last && (
            <div className="bg-[#E3F3EA] border border-[#E7E3D8] rounded-xl p-3 text-center" data-testid="scan-result">
              <CheckCircle2 className="mx-auto text-[#0E4E31]" size={26} />
              <div className="font-bold text-[#0E4E31] mt-1">{last.name}</div>
              <div className="text-xs text-[#5F6B63] mt-0.5">
                {last.message || (last.already ? "Sudah hadir sebelumnya" : "Hadir dicatat")}
              </div>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
