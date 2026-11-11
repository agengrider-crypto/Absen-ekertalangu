import Modal from "@/components/Modal";

/**
 * ActionModal — daftar aksi (pengganti dropdown).
 * Memakai komponen Modal bersama: tengah layar di desktop, bottom sheet di HP.
 *
 * Pemakaian:
 *   <ActionModal title="Aksi Kegiatan" subtitle={k.name} onClose={...} actions={[
 *     { key: "share", label: "Bagikan Rekap", desc: "...", icon: Share2, onClick: fn },
 *     { key: "hapus", label: "Hapus", icon: Trash2, hapus: true, onClick: fn },
 *   ]} />
 */
export default function ActionModal({ title, subtitle, actions = [], onClose, testid = "action-modal", children }) {
  const hasDelete = actions.some((a) => a && a.hapus);

  return (
    <Modal
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      testid={testid}
      maxWidth={560}
      bodyClassName="p-3"
      footer={(
        <button
          data-testid={`${testid}-cancel`}
          onClick={onClose}
          className="h-12 w-full rounded-2xl bg-[#F0EEE6] font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]"
        >
          {hasDelete ? "Batalkan" : "Tutup"}
        </button>
      )}
    >
      {children}
      {actions.filter(Boolean).map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.key}
            data-testid={a.testid || `action-${a.key}`}
            disabled={a.disabled}
            onClick={() => {
              const keepOpen = a.onClick?.();
              if (keepOpen !== false) onClose?.();
            }}
            className={`flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              a.hapus ? "hover:bg-[#FBE5E3]" : "hover:bg-[#F6F4EE]"
            }`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: a.hapus ? "#FBE5E3" : "#F0EEE6",
                color: a.hapus ? "#A32A2A" : "#14201A",
              }}
            >
              {Icon && <Icon size={19} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`flex items-center gap-1.5 text-[15px] font-semibold ${a.hapus ? "text-[#A32A2A]" : "text-[#14201A]"}`}>
                {a.label}
                {a.badge && (
                  <span
                    data-testid={`${a.testid || `action-${a.key}`}-badge`}
                    className="h-2 w-2 shrink-0 rounded-full bg-[#A32A2A]"
                    aria-label="baru"
                  />
                )}
              </span>
              {a.desc && <span className="mt-0.5 block text-xs text-[#5F6B63]">{a.desc}</span>}
            </span>
          </button>
        );
      })}
    </Modal>
  );
}
