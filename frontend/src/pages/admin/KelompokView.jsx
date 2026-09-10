import { useCallback, useEffect, useState } from "react";
import {
  Layers, Plus, Pencil, Trash2, Loader2, Users, X, AlertTriangle, Check,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

/**
 * FASE 7 — Kelola Kelompok Sambung.
 *
 * Kelompok bawaan: "Bali" dan "Luar Bali". Penghapusan kelompok WAJIB melewati
 * pop-up konfirmasi (Ya / Tidak) beserta kolom keterangan alasan penghapusan.
 */
export default function KelompokView() {
  const [items, setItems] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);

  const load = useCallback(() => {
    api.get("/admin/kelompok")
      .then(({ data }) => setItems(data || []))
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); setItems([]); });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="kelompok-view">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827]">Kelompok Sambung</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Kelola daftar kelompok sambung peserta.</p>
        </div>
        <button
          data-testid="button-add-kelompok"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold hover:bg-[#094229]"
        >
          <Plus size={18} /> Tambah Kelompok
        </button>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
          Belum ada kelompok sambung.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((k) => (
            <div key={k.id} data-testid={`kelompok-card-${k.id}`} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="h-10 w-10 rounded-xl bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center shrink-0">
                    <Layers size={20} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[#111827] truncate">{k.name}</div>
                    <div className="text-xs text-[#6B7280] mt-0.5">{k.description || "Tanpa keterangan"}</div>
                    <div className="text-xs text-[#0D5C3A] font-semibold mt-1.5 inline-flex items-center gap-1">
                      <Users size={13} /> {k.member_count || 0} anggota
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    data-testid={`button-edit-kelompok-${k.id}`}
                    onClick={() => setEditItem(k)}
                    className="h-9 w-9 rounded-lg border border-[#E5E7EB] text-[#4B5563] flex items-center justify-center hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                    title="Ubah nama"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    data-testid={`button-delete-kelompok-${k.id}`}
                    onClick={() => setDelItem(k)}
                    className="h-9 w-9 rounded-lg border border-[#FECACA] text-[#DC2626] flex items-center justify-center hover:bg-[#FEF2F2]"
                    title="Hapus kelompok"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <FormModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {editItem && <FormModal initial={editItem} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); load(); }} />}
      {delItem && <DeleteModal item={delItem} onClose={() => setDelItem(null)} onDone={() => { setDelItem(null); load(); }} />}
    </div>
  );
}

function FormModal({ initial, onClose, onDone }) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Nama kelompok wajib diisi"); return; }
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/admin/kelompok/${initial.id}`, { name, description: desc || null });
        toast.success("Kelompok diperbarui");
      } else {
        await api.post("/admin/kelompok", { name, description: desc || null });
        toast.success("Kelompok ditambahkan");
      }
      onDone();
    } catch (ex) {
      toast.error(formatApiErrorDetail(ex.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onClose} title={editing ? "Ubah Kelompok" : "Tambah Kelompok"} testid="modal-kelompok-form">
      <form onSubmit={submit} className="p-5 space-y-3">
        <div>
          <label className="text-xs font-semibold text-[#4B5563]">Nama Kelompok</label>
          <input
            data-testid="kelompok-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth: Bali / Luar Bali"
            className="mt-1 w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#4B5563]">Keterangan (opsional)</label>
          <input
            data-testid="kelompok-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-1 w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A]"
          />
        </div>
        <button
          type="submit"
          data-testid="kelompok-submit"
          disabled={busy}
          className="w-full h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Simpan
        </button>
      </form>
    </Overlay>
  );
}

function DeleteModal({ item, onClose, onDone }) {
  const [ket, setKet] = useState("");
  const [busy, setBusy] = useState(false);

  const hapus = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/admin/kelompok/${item.id}`, { params: { keterangan: ket } });
      toast.success(data.message || "Kelompok dihapus");
      onDone();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onClose} title="Konfirmasi Hapus Kelompok" testid="modal-kelompok-delete">
      <div className="p-5">
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 flex gap-2.5">
          <AlertTriangle size={20} className="text-[#DC2626] shrink-0 mt-0.5" />
          <div className="text-sm text-[#991B1B]">
            Hapus kelompok <b>{item.name}</b>?
            {item.member_count > 0 && (
              <> <b>{item.member_count} anggota</b> di dalamnya akan menjadi <b>tanpa kelompok</b> dan perlu dipindah-sambung ulang.</>
            )}
            <div className="mt-1">Tindakan ini tidak bisa dibatalkan.</div>
          </div>
        </div>

        <label className="block text-xs font-semibold text-[#4B5563] mt-4">Keterangan (alasan penghapusan)</label>
        <textarea
          data-testid="kelompok-delete-keterangan"
          value={ket}
          onChange={(e) => setKet(e.target.value)}
          rows={3}
          placeholder="cth: kelompok digabung ke Bali, sudah tidak dipakai, dsb."
          className="mt-1 w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] text-sm"
        />

        <div className="flex gap-2 mt-4">
          <button
            data-testid="kelompok-delete-no"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
          >
            Tidak
          </button>
          <button
            data-testid="kelompok-delete-yes"
            onClick={hapus}
            disabled={busy}
            className="flex-1 h-11 rounded-xl bg-[#DC2626] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#B91C1C] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />} Ya, Hapus
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title, testid }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" data-testid={testid}>
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between">
          <h3 className="font-heading font-bold text-[#111827]">{title}</h3>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
