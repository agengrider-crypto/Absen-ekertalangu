import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, List, Grid3x3, ChevronLeft, ChevronRight, Loader2, X,
  CheckCircle2, Trash2, Search, Copy, Download,
  Clock, MapPin, Lock, ChevronDown, AlertTriangle,
  KeyRound, RefreshCw, Send, Layers, Play,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";
import {
  KEGIATAN_TYPES, typeLabel, timeOptions,
  tanggalPanjang, tanggalSingkat, hhmm, MONTH_SHORT,
  AUDIENCE_OPTIONS, GENDER_FILTER_OPTIONS, AUDIENCE_LABEL,
  PHASE_META, phaseOf, phaseGroup, phaseMeta, jenisOf, JENIS_CHIP, groupKegiatan,
  MARITAL_FILTER_OPTIONS, AGE_GROUP_OPTIONS, SESSION_LABEL_PRESETS,
  SESSION_DEFAULT_TIME, groupSessions,
} from "./kegiatanUtils";
import KegiatanDetail from "./KegiatanDetail";
import KegiatanFormModal from "./KegiatanFormModal";
import KegiatanBantuanModal from "./KegiatanBantuanModal";
import { ReminderModal } from "./KegiatanExtras";
import { RekapGabunganModal, SalinJadwalModal } from "./SesiExtras";
import ActionModal from "@/components/ActionModal";
import ListFab from "@/components/ListFab";

const inp = "w-full h-[46px] px-3.5 rounded-xl border border-[#8A948D] text-base outline-none focus:border-[#14633F] bg-white";
const TIMES = timeOptions();

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function KegiatanView({
  addRequest = 0,
  initialDetailId = null,
  onAddRequestHandled,
  onInitialDetailHandled,
  onSubPageChange,
}) {
  const handledAddRequest = useRef(0);
  const handledInitialDetailId = useRef(null);
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [items, setItems] = useState(null);
  const [view, setView] = useState("list");
  const [dayFilter, setDayFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [detailKey, setDetailKey] = useState(0);
  // FASE 10 — rekap per sesi & salin jadwal sesi
  const [gabunganId, setGabunganId] = useState(null);
  const [salinGroup, setSalinGroup] = useState(null);

  const load = useCallback(() => {
    setItems(null);
    api.get("/admin/kegiatan")
      .then(({ data }) => setItems(data))
      .catch((e) => { setItems(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (addRequest > handledAddRequest.current) {
      handledAddRequest.current = addRequest;
      setShowAdd(true);
      onAddRequestHandled?.();
    }
  }, [addRequest, onAddRequestHandled]);

  useEffect(() => {
    if (initialDetailId && initialDetailId !== handledInitialDetailId.current) {
      handledInitialDetailId.current = initialDetailId;
      setDetailId(initialDetailId);
      onInitialDetailHandled?.();
    }
  }, [initialDetailId, onInitialDetailHandled]);

  // Laporkan sub-halaman ke layout supaya jejak halaman di header ikut berubah.
  useEffect(() => {
    if (!onSubPageChange) return;
    if (detailId) onSubPageChange("Detail Kegiatan");
    else if (showAdd) onSubPageChange("Tambah Kegiatan");
    else if (editItem) onSubPageChange("Ubah Kegiatan");
    else onSubPageChange(null);
  }, [detailId, showAdd, editItem, onSubPageChange]);

  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const shiftMonth = (delta) => {
    let ny = y;
    let nm = m + delta;
    while (nm > 12) { nm -= 12; ny += 1; }
    while (nm < 1) { nm += 12; ny -= 1; }
    setDayFilter("");
    setSelectedIds(new Set());
    setMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    const term = search.trim().toLocaleLowerCase("id");
    const today = todayYmd();
    return items.filter((k) => {
      if (dayFilter && k.date !== dayFilter) return false;
      if (phaseFilter === "all" && !String(k.date || "").startsWith(month)) return false;
      if (typeFilter !== "all" && k.type !== typeFilter) return false;
      const phase = phaseOf(k);
      if (phaseFilter === "today" && phaseGroup(k) !== "terlaksana") return false;
      if (phaseFilter === "upcoming" && phase !== "akan_datang") return false;
      if (phaseFilter === "completed" && phase !== "selesai") return false;
      if (!term) return true;
      return [k.name, k.teacher, k.location, typeLabel(k.type)]
        .some((value) => String(value || "").toLocaleLowerCase("id").includes(term));
    });
  }, [items, dayFilter, month, typeFilter, phaseFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, typeFilter, phaseFilter, month, dayFilter]);

  const daysWithEvent = useMemo(() => {
    const s = {};
    (items || []).forEach((k) => { s[k.date] = (s[k.date] || 0) + 1; });
    return s;
  }, [items]);

  const groups = useMemo(() => groupKegiatan(paged), [paged]);
  const selectedTargets = filtered.filter((k) => selectedIds.has(k.id));
  const selectedVisibleCount = selectedTargets.length;

  const toggleStatus = async (k) => {
    try {
      await api.post(`/admin/kegiatan/${k.id}/${k.status === "open" ? "close" : "reopen"}`);
      toast.success(k.status === "open" ? "Kegiatan diselesaikan" : "Kegiatan dibuka kembali");
      load();
      setDetailKey((v) => v + 1);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const removeKegiatan = async (k) => {
    if (!window.confirm(`Hapus kegiatan "${k.name}"?`)) return;
    try {
      await api.delete(`/admin/kegiatan/${k.id}`);
      toast.success("Kegiatan dihapus");
      setDetailId(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const visibleIds = filtered.map((k) => k.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const toggleVisibleSelection = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleSelection = (id) => setSelectedIds((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const deleteSelected = async () => {
    const targets = selectedTargets;
    if (!targets.length) return;
    setDeletingSelected(true);
    const deleted = [];
    const failed = [];
    for (const kegiatan of targets) {
      try {
        await api.delete(`/admin/kegiatan/${kegiatan.id}`);
        deleted.push(kegiatan);
      } catch (e) {
        failed.push({ kegiatan, detail: formatApiErrorDetail(e.response?.data?.detail) });
      }
    }
    setSelectedIds((previous) => {
      const next = new Set(previous);
      deleted.forEach((k) => next.delete(k.id));
      return next;
    });
    if (deleted.length) toast.success(`${deleted.length} kegiatan dihapus.`);
    if (failed.length) {
      const failures = failed.map(({ kegiatan, detail }) => `${kegiatan.name}: ${detail}`).join("; ");
      toast.error(`${failed.length} kegiatan gagal dihapus. ${failures}`);
    }
    setDeletingSelected(false);
    setShowDeleteConfirm(false);
    load();
  };

  // Semua fitur kegiatan berada DI DALAM halaman detail (klik kegiatan di daftar)
  if (detailId) {
    return (
      <>
        <KegiatanDetail
          key={detailKey}
          kegiatanId={detailId}
          onBack={() => { setDetailId(null); load(); }}
          onChanged={load}
          onEdit={(k) => setEditItem(k)}
          onReminder={(k) => setReminderItem(k)}
          onToggleStatus={toggleStatus}
          onDelete={removeKegiatan}
          onRekapGabungan={(k) => setGabunganId(k.id)}
          onSalinJadwal={(k) => {
            const grp = (items || []).filter((x) => k.session_group_id && x.session_group_id === k.session_group_id);
            const list = grp.length ? grp.sort((a, b) => (a.session_index ?? 0) - (b.session_index ?? 0)) : [k];
            setSalinGroup({ items: list });
          }}
        />
        {editItem && (
          <KegiatanFormModal
            initial={editItem}
            suggestions={Array.isArray(items) ? items : []}
            onClose={() => setEditItem(null)}
            onDone={() => { setEditItem(null); load(); setDetailKey((v) => v + 1); }}
          />
        )}
        {reminderItem && <ReminderModal kegiatan={reminderItem} onClose={() => setReminderItem(null)} />}
        {gabunganId && <RekapGabunganModal kegiatanId={gabunganId} onClose={() => setGabunganId(null)} />}
        {salinGroup && (
          <SalinJadwalModal group={salinGroup} onClose={() => setSalinGroup(null)}
            onDone={() => { setSalinGroup(null); load(); }} />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[#0E4E31] font-bold text-lg">
        <CalendarDays size={20} /> Kegiatan
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative">
          <span className="sr-only">Cari kegiatan</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, pengajar, atau lokasi kegiatan"
            data-testid={ACTIVITIES.search}
            className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-11 pr-4 text-base outline-none focus:border-[#14633F]" />
        </label>
        <div className="flex items-center gap-2">
          <label htmlFor="kegiatan-type-filter" className="sr-only">Filter jenis kegiatan</label>
          <select id="kegiatan-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}
            data-testid={ACTIVITIES.typeFilter}
            className="h-11 min-w-36 rounded-xl border-2 border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A]">
            <option value="all">Semua jenis</option>
            {KEGIATAN_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
      </div>

      {/* Filter status kegiatan dipindah ke FAB (bottom bar) */}

      {/* Month nav + view toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button data-testid="button-prev-month" onClick={() => shiftMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E7E3D8] bg-white hover:border-[#14633F]"><ChevronLeft size={18} /></button>
          <div className="font-semibold text-[#14201A] min-w-[150px] text-center">{MONTH_SHORT[m - 1]} {y}</div>
          <button data-testid="button-next-month" onClick={() => shiftMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E7E3D8] bg-white hover:border-[#14633F]"><ChevronRight size={18} /></button>
        </div>
        <div className="hidden items-center gap-1 rounded-xl border border-[#E7E3D8] bg-white p-1 lg:flex">
          <button data-testid="view-list" onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold ${view === "list" ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63]"}`}><List size={16} /> Daftar</button>
          <button data-testid="view-calendar" onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold ${view === "calendar" ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63]"}`}><Grid3x3 size={16} /> Kalender</button>
        </div>
      </div>

      {view === "calendar" && (
        <CalendarMonth year={y} month={m} daysWithEvent={daysWithEvent} dayFilter={dayFilter} onPick={setDayFilter} />
      )}

      {dayFilter && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-[#5F6B63]">Menampilkan:</span>
          <span className="font-semibold text-[#0E4E31]">{tanggalPanjang(dayFilter)}</span>
          <button onClick={() => setDayFilter("")} className="text-[#A32A2A] font-semibold hover:underline">Tampilkan semua</button>
        </div>
      )}

      {/* List */}
      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>
      ) : items === false ? (
        <div className="rounded-2xl border border-[#FBE5E3] bg-white p-8 text-center">
          <p className="text-sm text-[#5F6B63]">Daftar kegiatan gagal dimuat.</p>
          <button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
        </div>
      ) : (
        <>
          {filtered.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7E3D8] bg-white px-3 py-2.5">
              <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#14201A]">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection}
                  data-testid={ACTIVITIES.selectAll} className="h-5 w-5 accent-[#14633F]" />
                Pilih semua yang tampil ({filtered.length})
              </label>
              {selectedVisibleCount > 0 && (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} data-testid={ACTIVITIES.deleteSelected}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#A32A2A] px-4 text-sm font-semibold text-white hover:bg-[#A32A2A]">
                  <Trash2 size={16} /> Hapus terpilih ({selectedVisibleCount})
                </button>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-10 text-center text-[#5F6B63]">
              {search || typeFilter !== "all" || phaseFilter !== "all" || dayFilter
                ? "Tidak ada kegiatan yang cocok dengan pencarian atau filter."
                : "Belum ada kegiatan pada periode ini."}
            </div>
          ) : (
            <div className="space-y-6">
              {groups.filter((g) => g.items.length > 0).map((g) => (
                <section key={g.key} data-testid={`kegiatan-group-${g.key}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center"
                      style={{ color: g.iconColor }}
                      aria-hidden="true"
                    >
                      <StatusIcon group={g.key} size={18} />
                    </span>
                    <span className="text-[13px] font-bold text-[#14201A]">{g.label}</span>
                    <span className="text-xs text-[#5F6B63]">{g.items.length} kegiatan</span>
                  </div>
                  <div className="grid gap-3">
                    {groupSessions(g.items).map((grp) => (
                      grp.single
                        ? <KegiatanCard key={grp.key} k={grp.k} selected={selectedIds.has(grp.k.id)} onSelect={() => toggleSelection(grp.k.id)}
                            onOpen={() => setDetailId(grp.k.id)} />
                        : <SessionGroupCard key={grp.key} group={grp} selectedIds={selectedIds} onToggle={toggleSelection} onOpen={setDetailId} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <ListFab
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Cari nama, pengajar, atau lokasi…"
        filters={[
          { key: "all", label: "Semua", dot: "#14201A", count: (items || []).filter((k) => String(k.date || "").startsWith(month)).length },
          { key: "upcoming", label: "Akan datang", dot: "#1D4F91", count: (items || []).filter((k) => phaseOf(k) === "akan_datang").length },
          { key: "today", label: "Terlaksana", dot: "#14633F", count: (items || []).filter((k) => phaseGroup(k) === "terlaksana").length },
          { key: "completed", label: "Selesai", dot: "#4A5650", count: (items || []).filter((k) => phaseOf(k) === "selesai").length },
        ]}
        filterValue={phaseFilter}
        onFilter={setPhaseFilter}
        filterLabel="Filter status"
        filterTestId={ACTIVITIES.phaseFilter}
        filterItemTestId={ACTIVITIES.phasePrefix}
        onAdd={() => setShowAdd(true)}
        addLabel="Tambah Kegiatan"
        page={safePage}
        pageCount={pageCount}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        actions={[
          {
            key: "panduan",
            label: "Animasi Panduan",
            testid: ACTIVITIES.helpButton,
            icon: Play,
            onClick: () => setShowHelp(true),
          },
          {
            key: "daftar",
            label: "Tampilan Daftar",
            testid: "view-list",
            icon: List,
            active: view === "list",
            onClick: () => setView("list"),
          },
          {
            key: "kalender",
            label: "Tampilan Kalender",
            testid: "view-calendar",
            icon: Grid3x3,
            active: view === "calendar",
            onClick: () => setView("calendar"),
          },
        ]}
      />

      {showAdd && <KegiatanFormModal suggestions={Array.isArray(items) ? items : []}
        onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {showDeleteConfirm && (
        <ActionModal
          title="Hapus kegiatan?"
          subtitle={`${selectedTargets.length} kegiatan dipilih`}
          onClose={() => setShowDeleteConfirm(false)}
          testid={ACTIVITIES.deleteConfirmModal}
          actions={[{
            key: "confirm-delete",
            label: deletingSelected ? "Menghapus…" : "Hapus",
            icon: Trash2,
            hapus: true,
            disabled: deletingSelected,
            onClick: deleteSelected,
          }]}
        >
          <p className="px-3 py-2 text-sm text-[#5F6B63]">
            Kegiatan yang dihapus tidak bisa dikembalikan.
          </p>
          <ul className="mx-3 mb-2 max-h-40 divide-y divide-[#E7E3D8] overflow-y-auto rounded-xl border border-[#E7E3D8]">
            {selectedTargets.map((kegiatan) => (
              <li key={kegiatan.id} className="px-3 py-2 text-sm text-[#14201A]">
                {kegiatan.date} · {kegiatan.name}
              </li>
            ))}
          </ul>
        </ActionModal>
      )}
      {showHelp && <KegiatanBantuanModal onClose={() => setShowHelp(false)} />}
      {gabunganId && <RekapGabunganModal kegiatanId={gabunganId} onClose={() => setGabunganId(null)} />}
      {salinGroup && (
        <SalinJadwalModal group={salinGroup} onClose={() => setSalinGroup(null)}
          onDone={(res) => {
            setSalinGroup(null);
            const d = res?.dates?.[0];
            if (d && d.slice(0, 7) !== month) { setDayFilter(""); setMonth(d.slice(0, 7)); } else load();
          }} />
      )}
    </div>
  );
}

function FilterBadges({ k }) {
  const labels = k.filter_labels || [];
  if (!labels.length) return null;
  return (
    <>
      {labels.map((l) => (
        <span key={l} data-testid="keg-filter-badge"
          className="inline-flex shrink-0 items-center rounded-full bg-[#F0EEE6] px-2 py-0.5 text-[11px] font-semibold text-[#3A4540]">{l}</span>
      ))}
    </>
  );
}

const MAPS_URL = (k) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k.maps_query || k.location)}`;

/** Tautan lokasi terpisah: membuka Google Maps tanpa membuka detail kegiatan. */
function LocationLink({ k, className = "" }) {
  if (!k.location && !k.maps_query) return null;
  return (
    <a
      href={MAPS_URL(k)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      data-testid={`kegiatan-lokasi-${k.id}`}
      title="Buka lokasi di Google Maps"
      className={`inline-flex min-w-0 items-center gap-1 rounded text-[#5F6B63] underline decoration-[#D9D4C5] underline-offset-2 transition-colors hover:text-[#0E4E31] hover:decoration-[#14633F] ${className}`}
    >
      <MapPin size={13} className="shrink-0" />
      <span className="truncate">{k.location || k.maps_query}</span>
    </a>
  );
}

function DateBlock({ k, muted = false }) {
  const [, mm, dd] = String(k.date || "").split("-");
  const month = MONTH_SHORT[(parseInt(mm, 10) || 1) - 1];
  const meta = phaseMeta(phaseGroup(k));
  return (
    <div
      data-testid={`${ACTIVITIES.datePrefix}-${k.id}`}
      className="flex h-[60px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] text-center text-white"
      style={{ backgroundColor: muted ? "#4A5650" : meta.solid }}
    >
      <span className="text-[22px] font-bold leading-none tabular-nums">{Number(dd) || "—"}</span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{month}</span>
    </div>
  );
}

/** Ikon status Layar 30 — bentuk berbeda per status, selalu ditemani teks. */
function StatusIcon({ group, size = 13 }) {
  const common = { size, strokeWidth: 2, "aria-hidden": "true" };
  if (group === "terlaksana") return <CheckCircle2 {...common} />;
  if (group === "akan_datang") return <Clock {...common} />;
  return <Lock {...common} />;
}

/** Chip jenis kegiatan: latar netral + titik warna jenis + nama jenis. */
function JenisChip({ type }) {
  const chip = JENIS_CHIP[jenisOf(type)];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: "#F0EEE6", color: chip.text }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chip.dot }} aria-hidden="true" />
      {typeLabel(type)}
    </span>
  );
}

function KegiatanCard({ k, selected, onSelect, onOpen }) {
  const group = phaseGroup(k);
  const meta = phaseMeta(group);
  const summary = [k.teacher, k.material].filter(Boolean).join(" · ");
  const counts = k.counts || {};
  const sudah = counts.hadir ?? 0;
  const total = counts.total ?? 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      aria-label={`Buka detail kegiatan ${k.name}`}
      data-testid={`kegiatan-card-${k.id}`}
      className={`group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-[18px] border bg-white py-3 pl-4 pr-3 outline-none transition-colors hover:border-[#14633F] focus-visible:border-[#14633F] focus-visible:ring-2 focus-visible:ring-[#14633F] focus-visible:ring-offset-1 sm:gap-4 sm:pr-4 ${
        selected ? "border-[#14633F] bg-[#F6F4EE]" : "border-[#E7E3D8]"
      }`}
    >
      {/* bar kiri 6px warna penuh status */}
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: meta.solid }}
        aria-hidden="true"
      />

      <label
        className="flex h-10 w-6 shrink-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        title={`Pilih kegiatan ${k.name}`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Pilih kegiatan ${k.name}`}
          data-testid={`${ACTIVITIES.checkboxPrefix}-${k.id}`}
          className="h-4 w-4 accent-[#14633F]"
        />
      </label>

      <DateBlock k={k} muted={group === "selesai"} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: meta.iconBg, color: meta.iconColor }}
          >
            <StatusIcon group={group} />
            {meta.badge}
          </span>
          <JenisChip type={k.type} />
          <FilterBadges k={k} />
          {k.auto_closed && <span className="shrink-0 text-[10px] text-[#5F6B63]">(auto)</span>}
        </div>
        <div className="mt-1 truncate text-[15px] font-bold text-[#14201A]">{k.name}</div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5F6B63]">
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock size={12} /> {k.start_time}–{k.end_time}
          </span>
          <span className="hidden shrink-0 text-[#D9D4C5] sm:inline">·</span>
          <LocationLink k={k} className="max-w-full" />
        </div>
        {summary && <div className="mt-0.5 truncate text-xs text-[#5F6B63]">{summary}</div>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[17px] font-bold leading-none tabular-nums text-[#14201A]">
          {sudah}/{total}
        </span>
        <span className="text-[11px] text-[#5F6B63]">sudah absen</span>
      </div>

      <ChevronRight size={18} className="shrink-0 text-[#D9D4C5] transition-colors group-hover:text-[#0E4E31]" />
    </div>
  );
}

/**
 * FASE 9 — Kegiatan 1 hari BEBERAPA WAKTU/SESI (pagi/sore/malam).
 *
 * Setiap sesi punya absensi, rekap, kode akses & barcode SENDIRI, sehingga
 * peserta yang hadir sesi pagi tidak otomatis terhitung hadir di sesi lain.
 * Daftar hanya menampilkan ringkasan; rekap per sesi & salin jadwal ada di detail.
 */
function SessionGroupCard({ group, selectedIds, onToggle, onOpen }) {
  const first = group.items[0];
  const [, , day] = String(first.date || "").split("-");
  const times = group.items.map((k) => k.start_time).filter(Boolean);
  const range = times.length ? `${times[0]}–${group.items[group.items.length - 1].end_time}` : "";
  return (
    <div
      className="rounded-2xl border border-[#E7E3D8] bg-white p-3 sm:p-4"
      data-testid={`kegiatan-sesi-group-${first.session_group_id}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <DateBlock k={first} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-[#14201A]">{first.base_name || first.name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FBF1D6] px-2 py-0.5 text-[11px] font-semibold text-[#6B4500]">
              <Layers size={11} /> {group.items.length} sesi
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5F6B63]">
            {range && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <Clock size={12} /> {range}
              </span>
            )}
            <span className="hidden shrink-0 text-[#D9D4C5] sm:inline">·</span>
            <LocationLink k={first} className="max-w-full" />
          </div>
        </div>
        <span className="hidden shrink-0 text-[11px] text-[#5F6B63] sm:inline">{typeLabel(first.type)}</span>
      </div>

      <ul className="mt-2.5 divide-y divide-[#F0EEE6] border-t border-[#F0EEE6]">
        {group.items.map((k) => {
          const meta = phaseMeta(phaseOf(k));
          return (
            <li key={k.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(k.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(k.id); }
                }}
                aria-label={`Buka detail sesi ${k.session_label || ""} ${first.base_name || first.name}`}
                data-testid={`kegiatan-card-${k.id}`}
                className="group flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 outline-none transition-colors hover:bg-[#F6F4EE] focus-visible:bg-[#F6F4EE] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14633F]"
              >
                <label
                  className="flex h-8 w-6 shrink-0 items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  title={`Pilih sesi ${k.session_label || ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(k.id)}
                    onChange={() => onToggle(k.id)}
                    aria-label={`Pilih sesi ${k.session_label || ""}`}
                    data-testid={`${ACTIVITIES.checkboxPrefix}-${k.id}`}
                    className="h-4 w-4 accent-[#14633F]"
                  />
                </label>
                <span className="w-14 shrink-0 text-sm font-semibold text-[#0E4E31]">{k.session_label || "Sesi"}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-[#5F6B63]">
                  {k.start_time}–{k.end_time}
                  {k.teacher ? ` · ${k.teacher}` : ""}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.badge}</span>
                <ChevronRight size={16} className="shrink-0 text-[#D9D4C5] transition-colors group-hover:text-[#0E4E31]" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CalendarMonth({ year, month, daysWithEvent, dayFilter, onPick }) {
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  const pad = (d) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 mb-4" data-testid="calendar-month">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#5F6B63] mb-1">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((h) => <div key={h} className="py-1">{h}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ymd = pad(d);
          const count = daysWithEvent[ymd] || 0;
          const active = dayFilter === ymd;
          return (
            <button
              key={ymd}
              data-testid={`cal-day-${ymd}`}
              onClick={() => onPick(active ? "" : ymd)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-colors ${
                active ? "bg-[#14633F] text-white" : count ? "bg-[#E3F3EA] text-[#0E4E31] font-semibold hover:bg-[#E3F3EA]" : "text-[#5F6B63] hover:bg-[#F0EEE6]"
              }`}
            >
              {d}
              {count > 0 && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-[#14633F]"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModalShell({ title, children, onClose, testid, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(20,32,26,0.5)] p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-[#F6F4EE] w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E7E3D8] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#14201A]">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}


const STATUS_BTN = {
  hadir: { label: "Hadir", on: "bg-[#14633F] text-white", off: "text-[#14633F]" },
  izin: { label: "Izin", on: "bg-[#8A5A00] text-white", off: "text-[#6B4500]" },
  sakit: { label: "Sakit", on: "bg-[#1D4F91] text-white", off: "text-[#1D4F91]" },
  alpha: { label: "Alpha", on: "bg-[#A32A2A] text-white", off: "text-[#A32A2A]" },
};

export function AbsensiModal({ kegiatanId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [openManual, setOpenManual] = useState(true);

  const load = useCallback(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/rekap`)
      .then(({ data: d }) => setData(d))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const mark = async (userId, status) => {
    setBusy(userId + status);
    try {
      const { data: res } = await api.post(`/admin/kegiatan/${kegiatanId}/absen`, { user_id: userId, status });
      // Fase 7: notifikasi HANYA untuk status "hadir" (izin & alpha tanpa notifikasi).
      if (res?.message) toast.success(res.message);
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(null); }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return t ? data.rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : data.rows;
  }, [data, q]);

  const k = data?.kegiatan;
  const c = data?.counts || {};
  const alphaAllowed = Boolean(k && (
    k.status !== "open"
    || Date.now() >= Date.parse(`${k.date}T${k.end_time}:00+08:00`)
  ));

  return (
    <ModalShell title={k ? k.name : "Absensi"} onClose={onClose} testid="modal-absensi" wide>
      {!data ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-xl bg-[#F0EEE6] p-3 text-center"><div className="text-xl font-bold text-[#14201A]">{c.total}</div><div className="text-xs text-[#5F6B63]">Total</div></div>
            <div className="rounded-xl bg-[#E3F3EA] p-3 text-center"><div className="text-xl font-bold text-[#0E4E31]">{c.hadir}</div><div className="text-xs text-[#5F6B63]">Hadir</div></div>
            <div className="rounded-xl bg-[#FBF1D6] p-3 text-center"><div className="text-xl font-bold text-[#6B4500]">{c.izin}</div><div className="text-xs text-[#5F6B63]">Izin</div></div>
            <div className="rounded-xl bg-[#E3EEFB] p-3 text-center"><div className="text-xl font-bold text-[#1D4F91]">{c.sakit || 0}</div><div className="text-xs text-[#5F6B63]">Sakit</div></div>
            <div className="rounded-xl bg-[#FBE5E3] p-3 text-center"><div className="text-xl font-bold text-[#A32A2A]">{c.alpha}</div><div className="text-xs text-[#5F6B63]">Alpha</div></div>
          </div>

          {/* Absen manual — bisa dibuka/tutup */}
          <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="absen-manual-section">
            <button
              data-testid="absen-manual-toggle"
              onClick={() => setOpenManual((v) => !v)}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F6F4EE]"
            >
              <span className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-[#E3F3EA] text-[#14633F] flex items-center justify-center"><CheckCircle2 size={18} /></span>
                <span>
                  <span className="block font-bold text-[#14201A] text-[15px]">Absen Manual</span>
                  <span className="block text-xs text-[#5F6B63]">Tandai Hadir / Izin / Sakit / Alpha per peserta</span>
                </span>
              </span>
              <ChevronDown size={20} className={`text-[#5F6B63] transition-transform ${openManual ? "rotate-180" : ""}`} />
            </button>

            {openManual && (
              <div className="border-t border-[#E7E3D8]">
                <div className="p-3 bg-[#F6F4EE]">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                    <input data-testid="absensi-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..." className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#8A948D] outline-none focus:border-[#14633F] bg-white" />
                  </div>
                </div>
                <div className="divide-y divide-[#E7E3D8] max-h-[46vh] overflow-y-auto">
                  {rows.length === 0 ? (
                    <div className="p-8 text-center text-[#5F6B63] text-sm">Tidak ada peserta.</div>
                  ) : rows.map((r) => (
                    <div key={r.user_id} data-testid={`absensi-row-${r.user_id}`} className="px-4 py-3 grid grid-cols-[1fr_auto_auto] items-center gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#14201A] text-sm truncate">{r.name}</div>
                        <div className="text-xs text-[#5F6B63] flex items-center gap-1.5">
                          {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                          {r.account_status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4500]">
                              <AlertTriangle size={11} /> Belum aktivasi
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-14 text-center font-mono text-[13px] tabular-nums text-[#5F6B63]">
                        {r.status === "hadir" && r.arrival_time ? hhmm(r.arrival_time) : "—"}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {["hadir", "izin", "sakit", "alpha"].map((s) => {
                          const active = r.status === s;
                          const cfg = STATUS_BTN[s];
                          return (
                            <button
                              key={s}
                              data-testid={`btn-${s}-${r.user_id}`}
                              disabled={busy === r.user_id + s || (s === "alpha" && !alphaAllowed)}
                              onClick={() => mark(r.user_id, s)}
                              title={s === "alpha" && !alphaAllowed ? "Alpha tersedia setelah kegiatan berakhir" : cfg.label}
                              className={`h-11 w-11 rounded-full text-xs font-bold border-2 transition-colors ${active ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#D9D4C5] hover:border-current`}`}
                            >
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function FeedbackModal({ kegiatan, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get(`/admin/kegiatan/${kegiatan.id}/feedback`)
      .then(({ data }) => setItems(data || []))
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); setItems([]); });
  }, [kegiatan.id]);

  return (
    <ModalShell title="Kotak Pesan / Saran" onClose={onClose} testid="modal-feedback">
      <div className="text-sm text-[#5F6B63] mb-3">
        Pesan &amp; saran dari peserta untuk <b className="text-[#14201A]">{kegiatan.name}</b>.
      </div>
      {items === null ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E7E3D8] bg-[#F6F4EE] p-8 text-center text-sm text-[#5F6B63]">
          Belum ada pesan / saran dari peserta.
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white divide-y divide-[#E7E3D8] max-h-[60vh] overflow-y-auto" data-testid="feedback-list">
          {items.map((f) => (
            <div key={f.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[#14201A] text-sm">{f.name}</div>
                <div className="text-xs text-[#5F6B63]">{f.created_at ? hhmm(f.created_at) : ""}</div>
              </div>
              <p className="text-sm text-[#5F6B63] mt-0.5 whitespace-pre-wrap break-words">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

/**
 * FASE 7 — Bagikan Kegiatan + Kode Akses Absensi (6 digit).
 *
 * Pemegang tautan memasukkan kode akses lalu langsung melihat daftar peserta
 * (aktif maupun belum aktivasi) untuk diabsen manual / scan barcode.
 * Kode berlaku sampai kegiatan ditutup/selesai dan bisa diperbarui kapan pun.
 */
function ShareAbsensiModal({ data, onClose }) {
  const [info, setInfo] = useState(data);
  const [busy, setBusy] = useState(false);

  const copyLink = () => { navigator.clipboard.writeText(info.link); toast.success("Tautan absensi disalin"); };
  const copyCode = () => { navigator.clipboard.writeText(info.code); toast.success("Kode akses disalin"); };
  const download = () => {
    const a = document.createElement("a");
    a.href = info.image;
    a.download = `absensi_${(info.kegiatan_name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const shareWa = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(info.wa_text || info.link)}`, "_blank");
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      const { data: d } = await api.post(`/admin/kegiatan/${info.kegiatan_id}/access/regenerate`);
      setInfo({ ...d, kegiatan_id: info.kegiatan_id });
      toast.success("Kode akses baru dibuat. Kode lama sudah tidak berlaku.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <ModalShell title="Bagikan Kegiatan + Kode Akses" onClose={onClose} testid="modal-akses">
      <div className="text-center">
        <img src={info.image} alt="QR Absensi Kegiatan" className="mx-auto w-52 h-52 rounded-xl border border-[#E7E3D8] p-2" data-testid="akses-qr-image" />

        <div className="mt-4 rounded-2xl border-2 border-dashed border-[#14633F] bg-[#F6F4EE] p-4">
          <div className="text-xs font-semibold text-[#0E4E31] flex items-center justify-center gap-1.5">
            <KeyRound size={14} /> KODE AKSES ABSENSI
          </div>
          <div className="mt-1 text-3xl font-bold tracking-[0.35em] text-[#0E4E31]" data-testid="akses-code">{info.code}</div>
          <div className="text-xs text-[#5F6B63] mt-1">
            Berlaku sampai kegiatan <b>ditutup/selesai</b>
            {info.valid_until ? <> · jadwal selesai {tanggalSingkat(String(info.valid_until).slice(0, 10))} {String(info.valid_until).slice(11, 16)} WITA</> : null}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={copyCode} data-testid="akses-copy-code" className="flex-1 h-10 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E3F3EA]"><Copy size={15} /> Salin Kode</button>
            <button onClick={regenerate} disabled={busy} data-testid="akses-regenerate" className="flex-1 h-10 rounded-xl bg-[#14633F] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} Perbarui Kode
            </button>
          </div>
        </div>

        <div className="mt-3 bg-white border border-[#E7E3D8] rounded-xl p-3 text-left">
          <p className="text-xs text-[#5F6B63] leading-relaxed">
            Buka tautan, masukkan kode akses, lalu pilih status peserta.
          </p>
        </div>

        <p className="text-xs text-[#5F6B63] mt-2 break-all px-2">{info.link}</p>

        <div className="flex gap-2 mt-3">
          <button onClick={copyLink} data-testid="akses-copy-link" className="flex-1 h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold flex items-center justify-center gap-2 hover:bg-[#E3F3EA]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} data-testid="akses-download" className="flex-1 h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]"><Download size={16} /> Unduh QR</button>
        </div>
        <button onClick={shareWa} data-testid="akses-share-wa" className="mt-2 w-full h-11 rounded-xl bg-[#14633F] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-95"><Send size={16} /> Bagikan lewat WhatsApp</button>
      </div>
    </ModalShell>
  );
}
