import { useEffect, useState } from "react";
import {
  Loader2, ShieldCheck, CalendarDays, Clock, Users, MoreHorizontal,
  ListChecks, ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TYPE_LABEL, TYPE_COLOR, tanggalSingkat } from "./kegiatanUtils";
import { DelegasiModal, ScanPesertaModal } from "./KegiatanExtras";
import { AbsensiModal } from "./KegiatanView";
import ActionModal from "@/components/ActionModal";

export default function PenjagaAbsenView() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState(null);
  const [delegasi, setDelegasi] = useState(null);
  const [manual, setManual] = useState(null);
  const [scan, setScan] = useState(null);
  const [actionFor, setActionFor] = useState(null);

  const load = () => {
    setItems(null);
    api.get(`/admin/kegiatan?month=${month}`)
      .then(({ data }) => setItems(data || []))
      .catch((e) => { setItems([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const shift = (d) => {
    const [y, m] = month.split("-").map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
          <ShieldCheck size={22} className="text-[#0D5C3A]" /> Penjaga Absen
        </h1>
        <p className="text-[#6B7280] text-sm">
          Tersedia <b>absen manual</b> dan <b>absen scan barcode</b>. Anda juga dapat menyerahkan hak
          pengisian absen ke orang terpilih saat tidak berada di lokasi — hak otomatis dicabut saat kegiatan ditutup.
        </p>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E5E7EB] p-2 mb-4 max-w-xs">
        <button onClick={() => shift(-1)} className="h-9 px-3 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] font-semibold">‹</button>
        <span className="text-sm font-semibold text-[#111827]">{monthLabel}</span>
        <button onClick={() => shift(1)} className="h-9 px-3 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] font-semibold">›</button>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-[#6B7280] text-sm">Tidak ada kegiatan bulan ini.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((k) => {
            const open = (k.status || "open") === "open";
            return (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`penjaga-keg-${k.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${open ? "bg-[#E8F5EE] text-[#065F46]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{open ? "Aktif" : "Ditutup"}</span>
                </div>
                <h3 className="font-heading font-bold text-[#111827] mt-1.5">{k.name}</h3>
                <div className="text-sm text-[#6B7280] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalSingkat(k.date)}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    data-testid={`penjaga-manual-${k.id}`}
                    onClick={() => setManual(k)}
                    className="h-10 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#094229]"
                  >
                    <ListChecks size={16} /> Absen Manual
                  </button>
                  <button
                    data-testid={`penjaga-scan-${k.id}`}
                    onClick={() => setScan(k)}
                    className="h-10 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#E8F5EE]"
                  >
                    <ScanLine size={16} /> Scan Barcode
                  </button>
                </div>
                <button
                  data-testid={`penjaga-manage-${k.id}`}
                  onClick={() => setActionFor(k)}
                  className="mt-2 w-full h-10 rounded-xl border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                >
                  <MoreHorizontal size={16} /> Aksi Lain
                </button>
              </div>
            );
          })}
        </div>
      )}

      {actionFor && (
        <ActionModal
          testid={`penjaga-action-${actionFor.id}`}
          title="Aksi Penjaga Absen"
          subtitle={actionFor.name}
          onClose={() => setActionFor(null)}
          actions={[
            { key: "manual", testid: `penjaga-act-manual-${actionFor.id}`, label: "Absen Manual", desc: "Tandai Hadir / Izin / Alpha per peserta", icon: ListChecks, onClick: () => setManual(actionFor) },
            { key: "scan", testid: `penjaga-act-scan-${actionFor.id}`, label: "Absen Scan Barcode", desc: "Scan QR pribadi peserta", icon: ScanLine, onClick: () => setScan(actionFor) },
            { key: "delegasi", testid: `penjaga-act-delegasi-${actionFor.id}`, label: "Kelola Delegasi", desc: "Serahkan hak absen ke orang terpilih", icon: Users, onClick: () => setDelegasi(actionFor) },
          ]}
        />
      )}

      {delegasi && <DelegasiModal kegiatan={delegasi} onClose={() => setDelegasi(null)} />}
      {manual && <AbsensiModal kegiatanId={manual.id} onClose={() => setManual(null)} onChanged={load} />}
      {scan && <ScanPesertaModal kegiatan={scan} onClose={() => setScan(null)} onChanged={load} />}
    </div>
  );
}
