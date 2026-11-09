import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Search, Loader2, UserPlus, Trash2, X, Eye, AlertTriangle,
  ClipboardList, CalendarDays, Heart, Printer, QrCode, CheckCircle2, ChevronLeft, ChevronRight,
  MoreHorizontal, User as UserIcon, History,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, API, formatApiErrorDetail } from "@/lib/api";
import { PARTICIPANTS } from "@/constants/testIds";
import { DateField } from "@/components/DateField";
import ActionModal from "@/components/ActionModal";
import ListFab from "@/components/ListFab";
import PesertaDetailModal from "./PesertaDetailModal";
import { genderLabel, statusBadge, MARITAL_OPTIONS } from "./adminUtils";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E8E8E4] text-base outline-none focus:border-[#111114] bg-white";

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
        className={`${box} shrink-0 rounded-full object-cover border border-[#E8E8E4]`}
        data-testid={`peserta-photo-${user.id}`}
      />
    );
  }
  return (
    <div className={`${box} shrink-0 rounded-full bg-[#F1F1EE] text-[#111114] flex items-center justify-center font-bold`}>
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
      <div className="mb-4 flex items-center gap-2 text-[#111114] font-bold text-lg">
        <Users size={20} /> Peserta &amp; Akun
        {users && <span className="text-sm font-medium text-[#6B7280]">({users.length})</span>}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Kategori peran" data-testid={PARTICIPANTS.roleFilter}>
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
              onClick={() => setRoleFilter(tab.key)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition-colors ${
                active ? "border-[#111114] bg-[#111114] text-white" : "border-[#E8E8E4] bg-white text-[#4B5563] hover:border-[#111114]"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-[#F3F4F6] text-[#374151]"}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            data-testid="input-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, nama pengguna, No HP..."
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E8E8E4] text-base outline-none focus:border-[#111114] bg-white"
          />
        </div>
        {activatableSelected.length > 0 && (
          <button data-testid={PARTICIPANTS.bulkActivateButton} onClick={bulkActivate}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#08452B]">
            <CheckCircle2 size={16} /> Aktifkan Terpilih ({activatableSelected.length})
          </button>
        )}
        {deletableSelected.length > 0 && (
          <button data-testid="button-bulk-delete" onClick={bulkDelete}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C]">
            <Trash2 size={16} /> Hapus Peserta ({deletableSelected.length})
          </button>
        )}
        {pendingWithoutDobSelected.length > 0 && (
          <span data-testid={PARTICIPANTS.pendingNoDobNotice} className="text-sm font-medium text-[#92400E]">
            {pendingWithoutDobSelected.length} akun perlu tanggal lahir valid sebelum diaktifkan.
          </span>
        )}
      </div>

      {/* Filter status aktivasi dipindah ke FAB (bottom bar) */}

      {/* FASE 10 — Kelengkapan data (tanggal lahir & status pernikahan) */}
      {users && roleFilter === "peserta" && counts.incomplete > 0 && (
        <div className={`mb-4 rounded-2xl border-2 p-3.5 flex flex-wrap items-center gap-3 ${statusFilter === "incomplete" ? "border-[#9D174D] bg-[#FDF2F8]" : "border-[#F5D0E3] bg-[#FDF2F8]/60"}`} data-testid="kelengkapan-banner">
          <span className="h-10 w-10 rounded-xl bg-[#9D174D] text-white flex items-center justify-center shrink-0"><ClipboardList size={18} /></span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-bold text-[#831843]">
              {counts.incomplete} peserta datanya belum lengkap
            </div>
            <div className="text-xs text-[#9D174D] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Tgl lahir kosong: <b>{counts.missingDob}</b></span>
              <span className="inline-flex items-center gap-1"><Heart size={12} /> Status nikah kosong: <b>{counts.missingMarital}</b></span>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
              Data ini dipakai penyaringan kegiatan khusus (kelompok usia / status pernikahan). Peserta yang datanya
              kosong <b>tidak masuk</b> daftar absen kegiatan khusus tersebut. Klik <b>nama peserta</b> untuk melengkapi.
            </p>
          </div>
          {statusFilter !== "incomplete" ? (
            <button data-testid="kelengkapan-show" onClick={() => setStatusFilter("incomplete")}
              className="h-10 px-4 rounded-xl bg-[#9D174D] text-white font-semibold text-sm hover:bg-[#831843]">Tampilkan daftar</button>
          ) : (
            <button data-testid="kelengkapan-hide" onClick={() => setStatusFilter("all")}
              className="h-10 px-4 rounded-xl border-2 border-[#9D174D] text-[#9D174D] font-semibold text-sm hover:bg-[#FDF2F8]">Tampilkan semua</button>
          )}
        </div>
      )}
      {users && roleFilter === "peserta" && counts.incomplete === 0 && statusFilter === "incomplete" && (
        <div className="mb-4 rounded-2xl border border-[#E8E8E4] bg-[#FAFAF8] p-3.5 text-sm text-[#111114] font-semibold" data-testid="kelengkapan-complete">
          Semua peserta sudah melengkapi tanggal lahir dan status pernikahan.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white" data-testid="peserta-table">
        {users === null ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>
        ) : users === false ? (
          <div className="p-10 text-center">
            <p className="text-[#6B7280]">Daftar akun gagal dimuat.</p>
            <button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#111114] px-4 font-semibold text-white">Coba lagi</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280]">{q ? "Tidak ada akun yang cocok." : "Belum ada akun pada kategori ini."}</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[#ECECE8] bg-[#FAFAF8] px-4 py-2.5">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#4B5563]" title="Pilih semua peserta yang memenuhi syarat aktivasi">
                <input
                  aria-label={`Pilih semua peserta yang bisa diaktifkan (${activationEligible.length})`}
                  type="checkbox"
                  className="h-4 w-4 accent-[#0D5C3A]"
                  checked={allChecked}
                  disabled={activationEligible.length === 0}
                  onChange={toggleAll}
                  data-testid={PARTICIPANTS.selectAllActivatable}
                />
                Pilih yang bisa diaktifkan
                <span className="rounded-full bg-[#F1F1EE] px-1.5 py-0.5 text-[11px] font-bold text-[#374151]">{activationEligible.length}</span>
              </label>
              <span className="text-xs text-[#9CA3AF]">{filtered.length} akun</span>
            </div>

            <ul className="divide-y divide-[#F1F1EE]">
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
                      className={`group flex cursor-pointer items-center gap-3 px-3 py-3 outline-none transition-colors hover:bg-[#FAFAF8] focus-visible:bg-[#FAFAF8] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#111114] sm:gap-4 sm:px-4 ${
                        isSelected ? "bg-[#FAFAF8]" : ""
                      }`}
                    >
                      <label
                        className="flex h-9 w-6 shrink-0 items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          aria-label={`Pilih ${u.name}`}
                          type="checkbox"
                          className="h-4 w-4 accent-[#111114]"
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
                          <span data-testid={`button-detail-${u.id}`} className="truncate text-[15px] font-semibold text-[#111827]">
                            {u.name}
                          </span>
                          {u.needs_completion && <AlertTriangle size={13} className="shrink-0 text-[#9CA3AF]" aria-label="Perlu dilengkapi" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#6B7280]">
                          <span className="truncate">{u.username ? `@${u.username}` : genderLabel(u.gender)}</span>
                          {u.phone && <span className="hidden shrink-0 sm:inline">· {u.phone}</span>}
                        </div>
                        {miss.length > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FDF2F8] px-2 py-0.5 text-[11px] font-semibold text-[#9D174D]">
                            <ClipboardList size={11} /> {miss.map((m) => MISSING_LABEL[m]).join(" & ")} belum diisi
                          </div>
                        )}
                      </div>

                      <div className="hidden shrink-0 items-center gap-1 md:flex">
                        {(u.roles || []).map((r) => (
                          <span key={r} className="rounded-full bg-[#F1F1EE] px-2 py-0.5 text-[11px] font-medium text-[#374151]">
                            {ROLE_NAMES[r] || r}
                          </span>
                        ))}
                      </div>

                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${b.cls}`}>{b.label}</span>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActionsFor(u); }}
                        aria-label={`Aksi lain untuk ${u.name}`}
                        title="Aksi lainnya"
                        data-testid={`button-more-${u.id}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#6B7280] transition-colors hover:bg-[#F1F1EE] hover:text-[#111114] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111114]"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <ListFab
        search={q}
        onSearch={setQ}
        searchPlaceholder="Cari nama, nama pengguna, No HP…"
        filters={[
          { key: "all", label: "Semua", count: counts.all },
          { key: "pending", label: "Belum Aktivasi", count: counts.pending },
          { key: "active", label: "Sudah Aktif", count: counts.active },
          { key: "incomplete", label: "Data Belum Lengkap", count: counts.incomplete },
        ]}
        filterValue={statusFilter}
        onFilter={setStatusFilter}
        filterLabel="Filter status"
        filterTestId={PARTICIPANTS.statusFilter}
        filterItemTestId={PARTICIPANTS.statusFilterPrefix}
        onAdd={() => setModal("add")}
        addLabel="Tambah Peserta"
        page={safePage}
        pageCount={pageCount}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        total={filtered.length}
        pageSize={PAGE_SIZE}
      />
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-[#FAFAF8] w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E8E8E4] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Tutup ${title}`} data-testid={PARTICIPANTS.closeModal} className="h-11 w-11 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F4F4F1]"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
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
                step === index ? "bg-[#111114] text-white" : step > index ? "bg-[#E8F5EE] text-[#0D5C3A]" : "bg-[#F7F7F5] text-[#9CA3AF]"
              }`}>
              <span className="mr-1">{index + 1}.</span>{label}
            </button>
          ))}
        </div>

        {step === 0 && <>
        <div className="flex items-start gap-3 rounded-2xl border border-[#B7E4CA] bg-[#E8F5EE] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D5C3A]"><UserPlus size={21} /></span>
          <div>
            <h3 className="font-bold text-[#14532D]">Akun baru menunggu aktivasi</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#166534]">
              Nama wajib diisi. Data lainnya bisa dilengkapi sekarang atau nanti.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5" data-testid={PARTICIPANTS.addMainSection}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">1</span>
            <div>
              <h3 className="font-bold text-[#111827]">Data utama peserta</h3>
              <p className="text-sm text-[#6B7280]">Isi nama terlebih dahulu. Data lainnya bisa dilengkapi nanti.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Nama lengkap <span className="text-[#DC2626]">*</span></span>
              <input data-testid={PARTICIPANTS.addName} required autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Masukkan nama peserta" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Jenis kelamin</span>
              <select data-testid={PARTICIPANTS.addGender} value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
                <option value="">Pilih jenis kelamin</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Status pernikahan</span>
              <select data-testid={PARTICIPANTS.addMarital} value={f.marital} onChange={(e) => set("marital", e.target.value)} className={inp}>
                <option value="">Pilih status</option>
                {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Tempat lahir</span>
              <input data-testid={PARTICIPANTS.addBirthplace} value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} placeholder="Contoh: Denpasar" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Tanggal lahir</span>
              <DateField testid={PARTICIPANTS.addDob} value={f.dob} onChange={(v) => set("dob", v)} placeholder="Pilih tanggal lahir" className="h-[46px]" />
              <span className="mt-1 block text-sm text-[#6B7280]">Diperlukan untuk aktivasi akun.</span>
            </label>
          </div>
        </section>
        </>}

        {step === 1 && <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5" data-testid={PARTICIPANTS.addContactSection}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F1EE] text-sm font-bold text-[#111114]">2</span>
            <div>
              <h3 className="font-bold text-[#111827]">Kontak dan kelompok</h3>
              <p className="text-sm text-[#6B7280]">Semua isian pada bagian ini bersifat opsional</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Nomor HP</span>
              <input data-testid={PARTICIPANTS.addPhone} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxxxx" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Nomor WhatsApp</span>
              <input data-testid={PARTICIPANTS.addWhatsapp} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Opsional" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Email</span>
              <input data-testid={PARTICIPANTS.addEmail} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="nama@email.com" className={inp} />
            </label>
            <label>
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Kelompok sambung</span>
              <select data-testid={PARTICIPANTS.addKelompok} value={f.kelompok_id} onChange={(e) => set("kelompok_id", e.target.value)} className={inp}>
                <option value="">Tanpa kelompok</option>
                {kelompok.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-base font-semibold text-[#374151]">Alamat</span>
              <input data-testid={PARTICIPANTS.addAddress} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Alamat tempat tinggal" className={inp} />
            </label>
          </div>
        </section>
        }

        {step === 2 && <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5" data-testid={PARTICIPANTS.addWizardReview}>
          <h3 className="mb-3 font-bold text-[#111827]">Tinjau data peserta</h3>
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
              <div key={label} className="rounded-xl bg-[#FAFAF8] p-3">
                <dt className="text-xs font-semibold text-[#6B7280]">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-[#111827]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-xl bg-[#E8F5EE] p-3 text-sm text-[#14532D]">
            Akun peserta akan menunggu aktivasi. Pastikan tanggal lahir benar agar peserta dapat mengaktifkan akunnya.
          </p>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-[#E8E8E4] bg-white px-3 py-2 text-sm font-semibold text-[#111827]">
            <input type="checkbox" data-testid={PARTICIPANTS.addWizardConfirm} checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)} className="h-5 w-5 accent-[#111114]" />
            Saya sudah memeriksa data peserta.
          </label>
        </section>}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-[#E8E8E4] bg-[#FAFAF8]/95 p-4 backdrop-blur">
          <button data-testid={step === 0 ? PARTICIPANTS.addCancel : PARTICIPANTS.addWizardPrevious} type="button"
            onClick={() => step === 0 ? onClose() : setStep((current) => Math.max(current - 1, 0))}
            className="min-h-12 flex-1 rounded-xl border-2 border-[#E8E8E4] bg-white text-base font-semibold text-[#374151] hover:bg-[#F4F4F1]">
            {step === 0 ? "Batal" : <><ChevronLeft size={17} className="mr-1 inline" /> Kembali</>}
          </button>
          {step < 2 ? (
            <button data-testid={PARTICIPANTS.addWizardNext} type="button" onClick={nextStep}
              className="min-h-12 flex-[2] rounded-xl bg-[#111114] text-base font-bold text-white hover:bg-black">
              Lanjut <ChevronRight size={17} className="ml-1 inline" />
            </button>
          ) : (
            <button data-testid={PARTICIPANTS.addSubmit} type="submit" disabled={saving || !reviewConfirmed}
              className="min-h-12 flex-[2] rounded-xl bg-[#0D5C3A] text-base font-bold text-white inline-flex items-center justify-center gap-2 hover:bg-[#09492E] disabled:opacity-60">
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
          <h1 className="inline-flex items-center gap-2 text-xl font-bold text-[#111827]">
            <QrCode size={22} /> Kartu Nama Peserta
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">Pilih peserta, tinjau kartu, lalu cetak name tag.</p>
        </div>
      </header>
      <div className="name-tag-screen-only space-y-4">
        <div className="rounded-2xl border border-[#D1E7DD] bg-[#F0FDF4] p-4 text-sm leading-relaxed text-[#14532D]">
          Barcode QR ini permanen untuk identifikasi nama tag. QR presensi peserta tetap memakai barcode berputar dari menu peserta.
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_190px]">
          <label className="relative">
            <span className="sr-only">Cari nama peserta</span>
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              data-testid={PARTICIPANTS.nameTagSearch}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama peserta"
              className="h-11 w-full rounded-xl border-2 border-[#E8E8E4] bg-white pl-11 pr-4 text-base outline-none focus:border-[#111114]"
            />
          </label>
          <label>
            <span className="sr-only">Filter kelompok</span>
            <select
              data-testid={PARTICIPANTS.nameTagGroupFilter}
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-[#E8E8E4] bg-white px-3 text-base outline-none focus:border-[#111114]"
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
              className="h-11 w-full rounded-xl border-2 border-[#E8E8E4] bg-white px-3 text-base outline-none focus:border-[#111114]"
            >
              <option value="all">Semua status</option>
              <option value="active">Sudah aktif</option>
              <option value="pending">Belum aktivasi</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#374151]">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisible}
              data-testid={PARTICIPANTS.nameTagSelectVisible}
              className="h-5 w-5 accent-[#0D5C3A]"
            />
            Pilih semua hasil ({filtered.length})
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} data-testid={PARTICIPANTS.nameTagClearSelection}
                className="min-h-11 rounded-lg border border-[#E8E8E4] bg-white px-3 text-sm font-semibold text-[#4B5563] hover:border-[#111114]">
                Hapus pilihan
              </button>
            )}
            <button type="button" aria-pressed={orientation === "portrait"} onClick={() => setOrientation("portrait")}
              data-testid={PARTICIPANTS.nameTagPortrait}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${orientation === "portrait" ? "border-[#0D5C3A] bg-[#F0FDF4] text-[#0D5C3A]" : "border-[#E8E8E4] bg-white text-[#4B5563]"}`}>
              Vertikal
            </button>
            <button type="button" aria-pressed={orientation === "landscape"} onClick={() => setOrientation("landscape")}
              data-testid={PARTICIPANTS.nameTagLandscape}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${orientation === "landscape" ? "border-[#0D5C3A] bg-[#F0FDF4] text-[#0D5C3A]" : "border-[#E8E8E4] bg-white text-[#4B5563]"}`}>
              Horizontal
            </button>
            <button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen((open) => !open)}
              data-testid={PARTICIPANTS.nameTagPreviewToggle} disabled={!visibleSelected.length}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E8E8E4] bg-white px-3 text-sm font-semibold text-[#374151] hover:border-[#111114] disabled:opacity-50">
              <Eye size={16} /> {previewOpen ? "Tutup pratinjau" : `Pratinjau cetak (${visibleSelected.length})`}
            </button>
            <button type="button" onClick={printTags} data-testid={PARTICIPANTS.nameTagPrint}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#111114] px-4 text-sm font-semibold text-white hover:bg-black">
              <Printer size={16} /> Cetak ({visibleSelected.length})
            </button>
          </div>
        </div>

        {previewOpen && (
          <section className="name-tag-screen-only rounded-xl border border-[#E8E8E4] bg-[#F7F7F5] p-3 sm:p-4" data-testid={PARTICIPANTS.nameTagPreview}>
            <div className="mb-3">
              <h3 className="font-bold text-[#111827]">Pratinjau siap cetak</h3>
              <p className="text-sm text-[#6B7280]">{visibleSelected.length} kartu terpilih · {orientation === "portrait" ? "Vertikal" : "Horizontal"}</p>
            </div>
            {visibleSelected.length ? (
              <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2">
                {visibleSelected.map((user) => <NameTagCard key={user.id} user={user} orientation={orientation} preview />)}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-5 text-center text-sm text-[#6B7280]">
                Pilih peserta untuk melihat kartu yang siap dicetak.
              </p>
            )}
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E8E8E4] bg-white p-8 text-sm text-[#6B7280]">
            <Loader2 className="animate-spin" size={18} /> Memuat daftar peserta...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-[#FECACA] bg-white p-6 text-center">
            <p className="text-sm text-[#6B7280]">Daftar peserta gagal dimuat.</p>
            <button type="button" onClick={onRetry} data-testid={PARTICIPANTS.nameTagRetry} className="mt-3 min-h-11 rounded-xl bg-[#111114] px-4 font-semibold text-white">Coba lagi</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-8 text-center text-sm text-[#6B7280]">
            Tidak ada peserta yang cocok dengan pencarian atau filter.
          </div>
        ) : (
          <div className={`name-tag-selection-list grid gap-3 ${orientation === "portrait" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`} data-orientation={orientation}>
            {filtered.map((user) => (
              <label key={user.id} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-sm font-medium text-[#374151] name-tag-screen-only">
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
                  className="h-5 w-5 accent-[#0D5C3A]"
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
      <QRCodeSVG value={`EKT:${user.id}`} title={`Barcode identitas ${user.name}`} size={108} level="M" />
    </div>
  );
}
