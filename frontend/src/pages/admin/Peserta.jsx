import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Search, Loader2, UserPlus, Trash2, X, Eye, AlertTriangle,
  ClipboardList, CalendarDays, Heart, Printer, QrCode, CheckCircle2, ChevronLeft, ChevronRight,
  MoreHorizontal, User as UserIcon, History, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, API, formatApiErrorDetail } from "@/lib/api";
import { PARTICIPANTS } from "@/constants/testIds";
import { DateField } from "@/components/DateField";
import ActionModal from "@/components/ActionModal";
import Modal from "@/components/Modal";
import ListFab, { ListPagination } from "@/components/ListFab";
import PesertaDetailModal from "./PesertaDetailModal";
import { genderLabel, statusBadge, MARITAL_OPTIONS } from "./adminUtils";

const inp = "w-full h-[46px] px-3.5 rounded-xl border border-[#8A948D] text-base outline-none focus:border-[#14633F] bg-white";

/**
 * FASE 10 — KELENGKAPAN DATA: tanggal lahir & status pernikahan dipakai untuk
 * penyaringan kegiatan (kelompok usia / khusus menikah). Peserta yang datanya
 * kosong tidak akan masuk daftar kegiatan khusus tersebut.
 */
export function dataMissing(u) {
  const m = [];
  if (!u?.dob || !/^\d{4}-\d{2}-\d{2}$/.test(String(u.dob).slice(0, 10))) m.push("dob");
  if (!u?.marital) m.push("marital");
  return m;
}
const MISSING_LABEL = { dob: "Tgl lahir", marital: "Status nikah" };
const ROLE_NAMES = { admin: "Admin", pengurus: "Pengurus", peserta: "Peserta", guru: "Guru" };

function normalizeParticipantDob(value) {
  const dob = String(value || "").slice(0, 10);
  let year;
  let month;
  let day;
  let match = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = dob.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
    if (match) [, day, month, year] = match;
    else {
      match = dob.match(/^(\d{4})[/.](\d{2})[/.](\d{2})$/);
      if (!match) return null;
      [, year, month, day] = match;
    }
  }
  const normalized = `${year}-${month}-${day}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized;
}

function PesertaAvatar({ user, size = "md" }) {
  const [err, setErr] = useState(false);
  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const box = size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-xs";
  if (user?.has_photo && !err) {
    return (
      <img
        src={`${API}/admin/users/${user.id}/photo`}
        alt={user.name}
        loading="lazy"
        onError={() => setErr(true)}
        className={`${box} shrink-0 rounded-full object-cover border border-[#E7E3D8]`}
        data-testid={`peserta-photo-${user.id}`}
      />
    );
  }
  return (
    <div className={`${box} shrink-0 rounded-full bg-[#E3F3EA] text-[#0E4E31] flex items-center justify-center font-bold`}>
      {initials}
    </div>
  );
}

export default function Peserta({ role = "admin", addRequest = 0, onAddRequestHandled }) {
  const isAdmin = role === "admin";
  const handledAddRequest = useRef(0);
  const [users, setUsers] = useState(null);
  const [kelompok, setKelompok] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | active | incomplete
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const roleTabRefs = useRef({});
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const [detailTab, setDetailTab] = useState("profil");
  const [actionsFor, setActionsFor] = useState(null);
  const [modal, setModal] = useState(null); // "add" | "bulk" | null
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const openDetail = (id, tab = "profil") => {
    setDetailTab(tab);
    setDetailId(id);
  };

  const load = () =>
    api.get("/admin/users")
      .then(({ data }) => setUsers(data))
      .catch((e) => {
        setUsers(false);
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      });

  useEffect(() => {
    load();
    api.get("/admin/kelompok")
      .then(({ data }) => setKelompok(data))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, []);

  useEffect(() => {
    if (addRequest > handledAddRequest.current) {
      handledAddRequest.current = addRequest;
      setModal("add");
      onAddRequestHandled?.();
    }
  }, [addRequest, onAddRequestHandled]);

  const counts = useMemo(() => {
    const all = users || [];
    const roleUsers = roleFilter === "all" ? all : all.filter((u) => u.roles?.includes(roleFilter));
    return {
      all: roleUsers.length,
      pending: roleUsers.filter((u) => u.status === "pending").length,
      active: roleUsers.filter((u) => u.status === "active").length,
      incomplete: roleUsers.filter((u) => dataMissing(u).length > 0).length,
      missingDob: roleUsers.filter((u) => dataMissing(u).includes("dob")).length,
      missingMarital: roleUsers.filter((u) => dataMissing(u).includes("marital")).length,
      roles: {
        peserta: all.filter((u) => u.roles?.includes("peserta")).length,
        pengurus: all.filter((u) => u.roles?.includes("pengurus")).length,
        admin: all.filter((u) => u.roles?.includes("admin")).length,
        guru: all.filter((u) => u.roles?.includes("guru")).length,
      },
    };
  }, [users, roleFilter]);

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = roleFilter === "all" ? users : users.filter((u) => u.roles?.includes(roleFilter));
    if (statusFilter === "pending") list = list.filter((u) => u.status === "pending");
    else if (statusFilter === "active") list = list.filter((u) => u.status === "active");
    else if (statusFilter === "incomplete") list = list.filter((u) => dataMissing(u).length > 0);
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) =>
      (u.name || "").toLowerCase().includes(t) ||
      (u.username || "").toLowerCase().includes(t) ||
      (u.phone || "").toLowerCase().includes(t) ||
      (u.birthplace || "").toLowerCase().includes(t));
  }, [users, q, statusFilter, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [q, statusFilter, roleFilter]);

  // Tab aktif otomatis tergulir ke tampilan.
  useEffect(() => {
    roleTabRefs.current[roleFilter]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [roleFilter]);

  const selectedParticipants = (users || []).filter((u) =>
    selected.has(u.id) && u.roles?.includes("peserta"));
  const pureParticipants = selectedParticipants.filter((u) => u.roles?.length === 1);
  const deletableSelected = pureParticipants;
  const activationEligible = filtered.filter((u) =>
    u.roles?.length === 1 && u.roles.includes("peserta") &&
    u.status === "pending" && !!normalizeParticipantDob(u.dob));
  const activatableSelected = activationEligible.filter((u) => selected.has(u.id));
  const pendingWithoutDobSelected = pureParticipants.filter((u) =>
    u.status === "pending" && !normalizeParticipantDob(u.dob));
  const detailUser = (users || []).find((u) => u.id === detailId);

  const allChecked = activationEligible.length > 0 && activationEligible.every((u) => selected.has(u.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) activationEligible.forEach((u) => next.delete(u.id));
      else activationEligible.forEach((u) => next.add(u.id));
      return next;
    });
  };
  const toggleOne = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkDelete = async () => {
    const ids = deletableSelected.map((u) => u.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Hapus ${ids.length} peserta terpilih? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const { data } = await api.post("/admin/users/bulk-delete", { ids });
      toast.success(`${data.deleted} peserta dihapus`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const bulkActivate = async () => {
    const ids = activatableSelected.map((u) => u.id);
    if (!ids.length) return;
    const confirmed = window.confirm(
      `Aktifkan ${ids.length} akun peserta terpilih? Kata sandi sementara memakai tanggal lahir format DDMMYYYY dan wajib diganti saat pertama masuk.`,
    );
    if (!confirmed) return;
    try {
      const { data } = await api.post("/admin/users/bulk-activate", { ids });
      setSelected(new Set());
      await load();
      if (data.activated.length) {
        toast.success(`${data.activated.length} akun diaktifkan. Nama pengguna tercantum di daftar; kata sandi awalnya tanggal lahir (DDMMYYYY) dan wajib diganti saat login.`);
      }
      if (data.skipped.length) {
        toast.warning(`${data.skipped.length} akun tidak diaktifkan. Periksa status dan tanggal lahirnya.`);
      }
      if (!data.activated.length && !data.skipped.length) {
        toast.error("Tidak ada akun yang diproses.");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[#0E4E31] font-bold text-lg">
        <Users size={20} /> Peserta &amp; Akun
        {users && <span className="text-sm font-medium text-[#5F6B63]">({users.length})</span>}
      </div>

      <div
        className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Kategori peran"
        data-testid={PARTICIPANTS.roleFilter}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollSnapType: "x proximity" }}
      >
        {[
          { key: "all", label: "Semua", count: users?.length || 0 },
          { key: "peserta", label: "Peserta", count: counts.roles.peserta },
          { key: "pengurus", label: "Pengurus", count: counts.roles.pengurus },
          { key: "admin", label: "Admin", count: counts.roles.admin },
          { key: "guru", label: "Guru", count: counts.roles.guru },
        ].map((tab) => {
          const active = roleFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-pressed={active}
              data-testid={`${PARTICIPANTS.roleTabPrefix}-${tab.key}`}
              ref={(node) => { roleTabRefs.current[tab.key] = node; }}
              onClick={() => setRoleFilter(tab.key)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition-colors ${
                active ? "border-[#14633F] bg-[#14633F] text-white" : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F]"
              }`}
              style={{ scrollSnapAlign: "start" }}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-[#F0EEE6] text-[#14201A]"}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          <input
            data-testid="input-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, nama pengguna, No HP..."
            className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-11 pr-4 text-base outline-none focus:border-[#14633F]"
          />
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            data-testid={PARTICIPANTS.statusFilter}
            onClick={() => setShowStatusFilter((v) => !v)}
            aria-label="Filter status"
            aria-expanded={showStatusFilter}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-colors ${
              statusFilter !== "all"
                ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F]"
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
          {showStatusFilter && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-2xl border border-[#E7E3D8] bg-white p-2 shadow-xl">
              {[
                { key: "all", label: "Semua", count: counts.all },
                { key: "pending", label: "Belum Aktivasi", count: counts.pending },
                { key: "active", label: "Sudah Aktif", count: counts.active },
                { key: "incomplete", label: "Data Belum Lengkap", count: counts.incomplete },
              ].map((f) => {
                const on = statusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    data-testid={`${PARTICIPANTS.statusFilterPrefix}-${f.key}`}
                    onClick={() => { setStatusFilter(f.key); setShowStatusFilter(false); }}
                    aria-pressed={on}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-sm font-semibold ${
                      on ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63] hover:bg-[#F6F4EE]"
                    }`}
                  >
                    {f.label}
                    <span className="rounded-full bg-[#F0EEE6] px-2 py-0.5 text-[11px] text-[#14201A]">{f.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {activatableSelected.length > 0 && (
          <button data-testid={PARTICIPANTS.bulkActivateButton} onClick={bulkActivate}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold text-sm hover:bg-[#0E4E31]">
            <CheckCircle2 size={16} /> Aktifkan Terpilih ({activatableSelected.length})
          </button>
        )}
        {deletableSelected.length > 0 && (
          <button data-testid="button-bulk-delete" onClick={bulkDelete}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#A32A2A] text-white font-semibold text-sm hover:bg-[#A32A2A]">
            <Trash2 size={16} /> Hapus Peserta ({deletableSelected.length})
          </button>
        )}
        {pendingWithoutDobSelected.length > 0 && (
          <span data-testid={PARTICIPANTS.pendingNoDobNotice} className="text-sm font-medium text-[#6B4500]">
            {pendingWithoutDobSelected.length} akun perlu tanggal lahir valid sebelum diaktifkan.
          </span>
        )}
      </div>

      {/* Filter status aktivasi dipindah ke FAB (bottom bar) */}

      {/* FASE 10 — Kelengkapan data (tanggal lahir & status pernikahan) */}
      {users && roleFilter === "peserta" && counts.incomplete > 0 && (
        <div className={`mb-4 rounded-2xl border-2 p-3.5 flex flex-wrap items-center gap-3 ${statusFilter === "incomplete" ? "border-[#A32A2A] bg-[#FBE5E3]" : "border-[#FBE5E3] bg-[#FBE5E3]/60"}`} data-testid="kelengkapan-banner">
          <span className="h-10 w-10 rounded-xl bg-[#A32A2A] text-white flex items-center justify-center shrink-0"><ClipboardList size={18} /></span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-bold text-[#A32A2A]">
              {counts.incomplete} peserta datanya belum lengkap
            </div>
            <div className="text-xs text-[#A32A2A] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Tgl lahir kosong: <b>{counts.missingDob}</b></span>
              <span className="inline-flex items-center gap-1"><Heart size={12} /> Status nikah kosong: <b>{counts.missingMarital}</b></span>
            </div>
            <p className="text-[11px] text-[#5F6B63] mt-1 leading-relaxed">
              Data ini dipakai penyaringan kegiatan khusus (kelompok usia / status pernikahan). Peserta yang datanya
              kosong <b>tidak masuk</b> daftar absen kegiatan khusus tersebut. Klik <b>nama peserta</b> untuk melengkapi.
            </p>
          </div>
          {statusFilter !== "incomplete" ? (
            <button data-testid="kelengkapan-show" onClick={() => setStatusFilter("incomplete")}
              className="h-10 px-4 rounded-xl bg-[#A32A2A] text-white font-semibold text-sm hover:bg-[#A32A2A]">Tampilkan daftar</button>
          ) : (
            <button data-testid="kelengkapan-hide" onClick={() => setStatusFilter("all")}
              className="h-10 px-4 rounded-xl border-2 border-[#A32A2A] text-[#A32A2A] font-semibold text-sm hover:bg-[#FBE5E3]">Tampilkan semua</button>
          )}
        </div>
      )}
      {users && roleFilter === "peserta" && counts.incomplete === 0 && statusFilter === "incomplete" && (
        <div className="mb-4 rounded-2xl border border-[#E7E3D8] bg-[#F6F4EE] p-3.5 text-sm text-[#0E4E31] font-semibold" data-testid="kelengkapan-complete">
          Semua peserta sudah melengkapi tanggal lahir dan status pernikahan.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" data-testid="peserta-table">
        {users === null ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
        ) : users === false ? (
          <div className="p-10 text-center">
            <p className="text-[#5F6B63]">Daftar akun gagal dimuat.</p>
            <button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#5F6B63]">{q ? "Tidak ada akun yang cocok." : "Belum ada akun pada kategori ini."}</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[#E7E3D8] bg-[#F6F4EE] px-4 py-2.5">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5F6B63]" title="Pilih semua peserta yang memenuhi syarat aktivasi">
                <input
                  aria-label={`Pilih semua peserta yang bisa diaktifkan (${activationEligible.length})`}
                  type="checkbox"
                  className="h-4 w-4 accent-[#14633F]"
                  checked={allChecked}
                  disabled={activationEligible.length === 0}
                  onChange={toggleAll}
                  data-testid={PARTICIPANTS.selectAllActivatable}
                />
                Pilih yang bisa diaktifkan
                <span className="rounded-full bg-[#E3F3EA] px-1.5 py-0.5 text-[11px] font-bold text-[#14201A]">{activationEligible.length}</span>
              </label>
              <span className="text-xs text-[#5F6B63]">{filtered.length} akun</span>
            </div>

            <ul className="divide-y divide-[#F0EEE6]">
              {paged.map((u) => {
                const b = statusBadge(u.status, u.needs_completion);
                const miss = dataMissing(u);
                const isSelected = selected.has(u.id);
                return (
                  <li key={u.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(u.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(u.id); }
                      }}
                      aria-label={`Buka detail ${u.name}`}
                      data-testid={`peserta-row-${u.id}`}
                      className={`group flex cursor-pointer items-start gap-3 px-4 py-4 outline-none transition-colors hover:bg-[#F6F4EE] focus-visible:bg-[#F6F4EE] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14633F] sm:gap-4 ${
                        isSelected ? "bg-[#F6F4EE]" : ""
                      }`}
                    >
                      <label
                        className="flex h-11 w-11 shrink-0 items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          aria-label={`Pilih ${u.name}`}
                          type="checkbox"
                          className="h-4 w-4 accent-[#14633F]"
                          checked={isSelected}
                          onChange={() => toggleOne(u.id)}
                          data-testid={`checkbox-${u.id}`}
                        />
                      </label>

                      <span data-testid={`button-avatar-${u.id}`} className="shrink-0">
                        <PesertaAvatar user={u} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span data-testid={`button-detail-${u.id}`} className="truncate text-[15px] font-semibold text-[#14201A]">
                            {u.name}
                          </span>
                          {u.needs_completion && <AlertTriangle size={13} className="shrink-0 text-[#5F6B63]" aria-label="Perlu dilengkapi" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#5F6B63]">
                          <span className="truncate">{u.username ? `@${u.username}` : genderLabel(u.gender)}</span>
                          {u.phone && <span className="hidden shrink-0 sm:inline">· {u.phone}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {(u.roles || []).map((r) => (
                            <span key={r} className="inline-flex h-6 items-center rounded-full bg-[#E3F3EA] px-2.5 text-xs font-medium text-[#14201A]">
                              {ROLE_NAMES[r] || r}
                            </span>
                          ))}
                          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>
                          {miss.length > 0 && (
                            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#FBE5E3] px-2.5 text-xs font-semibold text-[#A32A2A]">
                              <ClipboardList size={11} />
                              {miss.length > 2 ? "Data belum lengkap" : `${miss.map((m) => MISSING_LABEL[m]).join(" & ")} belum diisi`}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActionsFor(u); }}
                        aria-label={`Aksi lain untuk ${u.name}`}
                        title="Aksi lainnya"
                        data-testid={`button-more-${u.id}`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#5F6B63] transition-colors hover:bg-[#E3F3EA] hover:text-[#0E4E31] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14633F]"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ListPagination
              page={safePage}
              pageCount={pageCount}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
              total={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>

      <ListFab onAdd={() => setModal("add")} addLabel="Tambah Peserta" />
      {detailId && (
        <PesertaDetailModal
          userId={detailId}
          initialTab={detailTab}
          kelompokList={kelompok}
          canManageRoles={isAdmin}
          canResetPassword={detailUser?.roles?.length === 1 && detailUser?.roles?.includes("peserta")}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}

      {actionsFor && (
        <ActionModal
          testid="peserta-row-actions"
          title="Aksi Peserta"
          subtitle={actionsFor.name}
          onClose={() => setActionsFor(null)}
          actions={[
            {
              key: "detail", testid: "row-action-detail", label: "Buka Detail",
              desc: "Profil lengkap peserta", icon: UserIcon,
              onClick: () => { openDetail(actionsFor.id, "profil"); },
            },
            {
              key: "kehadiran", testid: "row-action-kehadiran", label: "Kehadiran",
              desc: "Ringkasan & riwayat absensi", icon: ClipboardList,
              onClick: () => { openDetail(actionsFor.id, "kehadiran"); },
            },
            {
              key: "qr", testid: "row-action-qr", label: "QR Peserta",
              desc: "Lihat, cetak & unduh QR", icon: QrCode,
              onClick: () => { openDetail(actionsFor.id, "qr"); },
            },
            {
              key: "riwayat", testid: "row-action-riwayat", label: "Riwayat",
              desc: "Informasi akun & aktivitas", icon: History,
              onClick: () => { openDetail(actionsFor.id, "riwayat"); },
            },
          ]}
        />
      )}
      {modal === "add" && <AddModal kelompok={kelompok} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ModalShell({ title, children, onClose, testid, wide = false }) {
  return (
    <Modal
      onClose={onClose}
      title={title}
      testid={testid}
      closeTestId={PARTICIPANTS.closeModal}
      maxWidth={wide ? 960 : 640}
      bodyClassName="bg-[#F6F4EE] p-5"
    >
      {children}
    </Modal>
  );
}

function AddModal({ kelompok, onClose, onDone }) {
  const [f, setF] = useState({ name: "", gender: "", marital: "", birthplace: "", dob: "", phone: "", whatsapp: "", email: "", address: "", kelompok_id: "" });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const set = (k, v) => {
    setReviewConfirmed(false);
    setF((p) => ({ ...p, [k]: v }));
  };

  const nextStep = () => {
    if (step === 0 && !f.name.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    setReviewConfirmed(false);
    setStep((current) => Math.min(current + 1, 2));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step !== 2) {
      toast.info("Tinjau data peserta terlebih dahulu sebelum menyimpan.");
      return;
    }
    if (!f.name.trim()) { setStep(0); toast.error("Nama wajib diisi"); return; }
    if (!reviewConfirmed) {
      toast.error("Centang konfirmasi setelah memastikan data peserta sudah benar.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/users", {
        name: f.name, gender: f.gender || null, birthplace: f.birthplace || null,
        dob: f.dob || null, phone: f.phone || null, whatsapp: f.whatsapp || null,
        email: f.email || null, address: f.address || null, kelompok_id: f.kelompok_id || null,
        marital: f.marital || null,
        roles: ["peserta"],
      });
      toast.success(`Peserta "${f.name}" ditambahkan (menunggu aktivasi).`);
      onDone();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Tambah Peserta" onClose={onClose} testid={PARTICIPANTS.addModal} wide>
      <form onSubmit={submit} className="space-y-4" data-testid={PARTICIPANTS.addForm}>
        <div className="grid grid-cols-3 gap-1">
          {["Data Utama", "Kontak", "Tinjau"].map((label, index) => (
            <button key={label} type="button" onClick={() => index <= step && setStep(index)}
              aria-current={step === index ? "step" : undefined}
              data-testid={`${PARTICIPANTS.addWizardStepPrefix}-${index + 1}`}
              className={`min-h-10 rounded-lg px-1 text-xs font-semibold sm:text-sm ${
                step === index ? "bg-[#14633F] text-white" : step > index ? "bg-[#E3F3EA] text-[#0E4E31]" : "bg-[#F6F4EE] text-[#5F6B63]"
              }`}>
              <span className="mr-1">{index + 1}.</span>{label}
            </button>
          ))}
        </div>

        {step === 0 && <>
        <div className="flex items-start gap-3 rounded-2xl border border-[#E3F3EA] bg-[#E3F3EA] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0E4E31]"><UserPlus size={21} /></span>
          <div>
            <h3 className="font-bold text-[#0E4E31]">Akun baru menunggu aktivasi</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#0E4E31]">
              Nama wajib diisi. Data lainnya bisa dilengkapi sekarang atau nanti.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={PARTICIPANTS.addMainSection}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#14633F] text-sm font-bold text-white">1</span>
            <div>
              <h3 className="font-bold text-[#14201A]">Data utama peserta</h3>
              <p className="text-sm text-[#5F6B63]">Isi nama terlebih dahulu. Data lainnya bisa dilengkapi nanti.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Nama lengkap <span className="text-[#A32A2A]">*</span></span>
              <input data-testid={PARTICIPANTS.addName} required autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Masukkan nama peserta" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Jenis kelamin</span>
              <select data-testid={PARTICIPANTS.addGender} value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
                <option value="">Pilih jenis kelamin</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Status pernikahan</span>
              <select data-testid={PARTICIPANTS.addMarital} value={f.marital} onChange={(e) => set("marital", e.target.value)} className={inp}>
                <option value="">Pilih status</option>
                {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Tempat lahir</span>
              <input data-testid={PARTICIPANTS.addBirthplace} value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} placeholder="Contoh: Denpasar" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Tanggal lahir</span>
              <DateField testid={PARTICIPANTS.addDob} value={f.dob} onChange={(v) => set("dob", v)} placeholder="Pilih tanggal lahir" className="h-[46px]" />
              <span className="mt-1 block text-sm text-[#5F6B63]">Diperlukan untuk aktivasi akun.</span>
            </label>
          </div>
        </section>
        </>}

        {step === 1 && <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={PARTICIPANTS.addContactSection}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E3F3EA] text-sm font-bold text-[#0E4E31]">2</span>
            <div>
              <h3 className="font-bold text-[#14201A]">Kontak dan kelompok</h3>
              <p className="text-sm text-[#5F6B63]">Semua isian pada bagian ini bersifat opsional</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Nomor HP</span>
              <input data-testid={PARTICIPANTS.addPhone} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxxxx" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Nomor WhatsApp</span>
              <input data-testid={PARTICIPANTS.addWhatsapp} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Opsional" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Email</span>
              <input data-testid={PARTICIPANTS.addEmail} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="nama@email.com" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Kelompok sambung</span>
              <select data-testid={PARTICIPANTS.addKelompok} value={f.kelompok_id} onChange={(e) => set("kelompok_id", e.target.value)} className={inp}>
                <option value="">Tanpa kelompok</option>
                {kelompok.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-base font-semibold text-[#14201A]">Alamat</span>
              <input data-testid={PARTICIPANTS.addAddress} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Alamat tempat tinggal" className={inp} />
            </label>
          </div>
        </section>
        }

        {step === 2 && <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={PARTICIPANTS.addWizardReview}>
          <h3 className="mb-3 font-bold text-[#14201A]">Tinjau data peserta</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {[
              ["Nama lengkap", f.name],
              ["Jenis kelamin", f.gender === "L" ? "Laki-laki" : f.gender === "P" ? "Perempuan" : "Belum diisi"],
              ["Status pernikahan", MARITAL_OPTIONS.find((option) => option.value === f.marital)?.label || "Belum diisi"],
              ["Tempat, tanggal lahir", [f.birthplace, f.dob].filter(Boolean).join(", ") || "Belum diisi"],
              ["Nomor HP", f.phone || "Belum diisi"],
              ["WhatsApp", f.whatsapp || "Belum diisi"],
              ["Email", f.email || "Belum diisi"],
              ["Kelompok", kelompok.find((item) => item.id === f.kelompok_id)?.name || "Tanpa kelompok"],
              ["Alamat", f.address || "Belum diisi"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#F6F4EE] p-3">
                <dt className="text-xs font-semibold text-[#5F6B63]">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-[#14201A]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-xl bg-[#E3F3EA] p-3 text-sm text-[#0E4E31]">
            Akun peserta akan menunggu aktivasi. Pastikan tanggal lahir benar agar peserta dapat mengaktifkan akunnya.
          </p>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-[#E7E3D8] bg-white px-3 py-2 text-sm font-semibold text-[#14201A]">
            <input type="checkbox" data-testid={PARTICIPANTS.addWizardConfirm} checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)} className="h-5 w-5 accent-[#14633F]" />
            Saya sudah memeriksa data peserta.
          </label>
        </section>}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-[#E7E3D8] bg-[#F6F4EE]/95 p-4 backdrop-blur">
          <button data-testid={step === 0 ? PARTICIPANTS.addCancel : PARTICIPANTS.addWizardPrevious} type="button"
            onClick={() => step === 0 ? onClose() : setStep((current) => Math.max(current - 1, 0))}
            className="min-h-12 flex-1 rounded-xl border-2 border-[#E7E3D8] bg-white text-base font-semibold text-[#14201A] hover:bg-[#F0EEE6]">
            {step === 0 ? "Batal" : <><ChevronLeft size={17} className="mr-1 inline" /> Kembali</>}
          </button>
          {step < 2 ? (
            <button data-testid={PARTICIPANTS.addWizardNext} type="button" onClick={nextStep}
              className="min-h-12 flex-[2] rounded-xl bg-[#14633F] text-base font-bold text-white hover:bg-[#0E4E31]">
              Lanjut <ChevronRight size={17} className="ml-1 inline" />
            </button>
          ) : (
            <button data-testid={PARTICIPANTS.addSubmit} type="submit" disabled={saving || !reviewConfirmed}
              className="min-h-12 flex-[2] rounded-xl bg-[#14633F] text-base font-bold text-white inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />} Simpan Peserta
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

export function NameTagView({ users, kelompok, loading, loadError, onRetry }) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orientation, setOrientation] = useState("portrait");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((user) => {
        if (groupFilter !== "all" && user.kelompok_id !== groupFilter) return false;
        if (statusFilter !== "all" && user.status !== statusFilter) return false;
        return !term || (user.name || "").toLowerCase().includes(term);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
  }, [users, search, groupFilter, statusFilter]);

  const visibleSelected = filtered.filter((user) => selected.has(user.id));
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length;

  const toggleVisible = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) filtered.forEach((user) => next.delete(user.id));
      else filtered.forEach((user) => next.add(user.id));
      return next;
    });
  };

  const printTags = () => {
    if (!visibleSelected.length) {
      toast.error("Pilih minimal satu peserta untuk dicetak.");
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-5" data-testid={PARTICIPANTS.nameTagPage}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-bold text-[#14201A]">
            <QrCode size={22} /> Kartu Nama Peserta
          </h1>
          <p className="mt-1 text-sm text-[#5F6B63]">Pilih peserta, tinjau kartu, lalu cetak name tag.</p>
        </div>
      </header>
      <div className="name-tag-screen-only space-y-4">
        <div className="rounded-2xl border border-[#E3F3EA] bg-[#E3F3EA] p-4 text-sm leading-relaxed text-[#0E4E31]">
          Barcode QR ini permanen untuk identifikasi nama tag. QR presensi peserta tetap memakai barcode berputar dari menu peserta.
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_190px]">
          <label className="relative">
            <span className="sr-only">Cari nama peserta</span>
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
            <input
              data-testid={PARTICIPANTS.nameTagSearch}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama peserta"
              className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-11 pr-4 text-base outline-none focus:border-[#14633F]"
            />
          </label>
          <label>
            <span className="sr-only">Filter kelompok</span>
            <select
              data-testid={PARTICIPANTS.nameTagGroupFilter}
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-base outline-none focus:border-[#14633F]"
            >
              <option value="all">Semua kelompok</option>
              {kelompok.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter status akun</span>
            <select
              data-testid={PARTICIPANTS.nameTagStatusFilter}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-base outline-none focus:border-[#14633F]"
            >
              <option value="all">Semua status</option>
              <option value="active">Sudah aktif</option>
              <option value="pending">Belum aktivasi</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#14201A]">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisible}
              data-testid={PARTICIPANTS.nameTagSelectVisible}
              className="h-5 w-5 accent-[#14633F]"
            />
            Pilih semua hasil ({filtered.length})
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} data-testid={PARTICIPANTS.nameTagClearSelection}
                className="min-h-11 rounded-lg border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#5F6B63] hover:border-[#14633F]">
                Hapus pilihan
              </button>
            )}
            <button type="button" aria-pressed={orientation === "portrait"} onClick={() => setOrientation("portrait")}
              data-testid={PARTICIPANTS.nameTagPortrait}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${orientation === "portrait" ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]" : "border-[#E7E3D8] bg-white text-[#5F6B63]"}`}>
              Vertikal
            </button>
            <button type="button" aria-pressed={orientation === "landscape"} onClick={() => setOrientation("landscape")}
              data-testid={PARTICIPANTS.nameTagLandscape}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${orientation === "landscape" ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]" : "border-[#E7E3D8] bg-white text-[#5F6B63]"}`}>
              Horizontal
            </button>
            <button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen((open) => !open)}
              data-testid={PARTICIPANTS.nameTagPreviewToggle} disabled={!visibleSelected.length}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-50">
              <Eye size={16} /> {previewOpen ? "Tutup pratinjau" : `Pratinjau cetak (${visibleSelected.length})`}
            </button>
            <button type="button" onClick={printTags} data-testid={PARTICIPANTS.nameTagPrint}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
              <Printer size={16} /> Cetak ({visibleSelected.length})
            </button>
          </div>
        </div>

        {previewOpen && (
          <section className="name-tag-screen-only rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3 sm:p-4" data-testid={PARTICIPANTS.nameTagPreview}>
            <div className="mb-3">
              <h3 className="font-bold text-[#14201A]">Pratinjau siap cetak</h3>
              <p className="text-sm text-[#5F6B63]">{visibleSelected.length} kartu terpilih · {orientation === "portrait" ? "Vertikal" : "Horizontal"}</p>
            </div>
            {visibleSelected.length ? (
              <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2">
                {visibleSelected.map((user) => <NameTagCard key={user.id} user={user} orientation={orientation} preview />)}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[#D9D4C5] bg-white p-5 text-center text-sm text-[#5F6B63]">
                Pilih peserta untuk melihat kartu yang siap dicetak.
              </p>
            )}
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E7E3D8] bg-white p-8 text-sm text-[#5F6B63]">
            <Loader2 className="animate-spin" size={18} /> Memuat daftar peserta...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-[#FBE5E3] bg-white p-6 text-center">
            <p className="text-sm text-[#5F6B63]">Daftar peserta gagal dimuat.</p>
            <button type="button" onClick={onRetry} data-testid={PARTICIPANTS.nameTagRetry} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D9D4C5] bg-white p-8 text-center text-sm text-[#5F6B63]">
            Tidak ada peserta yang cocok dengan pencarian atau filter.
          </div>
        ) : (
          <div className={`name-tag-selection-list grid gap-3 ${orientation === "portrait" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`} data-orientation={orientation}>
            {filtered.map((user) => (
              <label key={user.id} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 py-2 text-sm font-medium text-[#14201A] name-tag-screen-only">
                <input
                  type="checkbox"
                  checked={selected.has(user.id)}
                  onChange={() => setSelected((previous) => {
                    const next = new Set(previous);
                    if (next.has(user.id)) next.delete(user.id);
                    else next.add(user.id);
                    return next;
                  })}
                  data-testid={`${PARTICIPANTS.nameTagCheckboxPrefix}-${user.id}`}
                  className="h-5 w-5 accent-[#14633F]"
                />
                <span className="truncate">{user.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="name-tag-print-area">
        <div className={`name-tag-print-grid name-tag-print-grid-${orientation}`} data-orientation={orientation}>
          {visibleSelected.map((user) => (
            <NameTagCard key={user.id} user={user} orientation={orientation} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NameTagCard({ user, orientation, preview = false }) {
  return (
    <div className={`name-tag-card name-tag-card-${orientation}${preview ? " name-tag-preview-card" : ""}`}>
      <div className="name-tag-card-name">{user.name}</div>
      <QRCodeSVG value={`EKT:${user.id}`} title={`Barcode identitas ${user.name}`} size={108} level="M" fgColor="#000000" bgColor="#FFFFFF" />
    </div>
  );
}
