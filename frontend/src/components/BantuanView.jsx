// FASE 19 — Halaman Bantuan: panduan langkah, tanya jawab, dan kontak pengurus.
import { useEffect, useMemo, useState } from "react";
import {
  LifeBuoy, BookOpen, MessageCircleQuestion, PhoneCall, ChevronDown, ScanLine,
  QrCode, ListChecks, CalendarDays, FileBarChart2, HeartHandshake, MailWarning,
  UserPlus, KeyRound, Loader2, Send, Mail, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";

const GUIDES = {
  peserta: {
    label: "Peserta",
    icon: QrCode,
    steps: [
      { icon: KeyRound, title: "Masuk ke aplikasi", desc: "Isi email / username / nomor HP, lalu kata sandi. Sandi awal peserta = tanggal lahir format HHBBTTTT (mis. 12031988)." },
      { icon: QrCode, title: "Tunjukkan QR Saya", desc: "Buka tab QR Saya lalu tunjukkan ke petugas absen. QR ini tetap, jadi aman disimpan sebagai tangkapan layar." },
      { icon: ScanLine, title: "Absen mandiri (bila dibuka)", desc: "Tab Scan dipakai saat pengurus membagikan barcode kegiatan: arahkan kamera ke barcode, kehadiran langsung tercatat." },
      { icon: CalendarDays, title: "Lihat jadwal & undangan", desc: "Tab Kegiatan memuat jadwal yang sesuai dengan data Anda. Undangan Penting muncul di beranda dan di lonceng notifikasi." },
      { icon: HeartHandshake, title: "Izin & Ruang Teduh", desc: "Ajukan izin lewat kegiatan terkait, atau kirim keluhan/masukan secara pribadi (boleh tanpa nama) di Ruang Teduh." },
    ],
  },
  pengurus: {
    label: "Pengurus",
    icon: ListChecks,
    steps: [
      { icon: CalendarDays, title: "Buat kegiatan", desc: "Daftar Kegiatan → Tambah Kegiatan. Isi nama, tanggal, jam, pengajar; aktifkan Beberapa waktu bila sehari ada pagi/sore/malam." },
      { icon: ListChecks, title: "Pilih pesertanya", desc: "Saring lewat jenis kelamin, status, dan kelompok usia — atau centang orangnya langsung dengan Pilih peserta tertentu (mode ceklis)." },
      { icon: ScanLine, title: "Catat kehadiran", desc: "Buka kegiatan → tab Absen Manual untuk mencentang satu-satu, atau tab Scan Barcode untuk memindai QR peserta." },
      { icon: UserPlus, title: "Tamu kegiatan terbuka", desc: "Khusus kegiatan publik, tab Tamu dipakai mencatat hadirin yang belum memiliki akun." },
      { icon: MailWarning, title: "Undangan penting", desc: "Tab Undangan Penting → centang peserta + tulis pesan. Undangan langsung tampil di lonceng dan beranda peserta." },
      { icon: FileBarChart2, title: "Bagikan rekap", desc: "Tab Rekap / Laporan menyediakan tautan publik, QR, dan tombol bagikan WhatsApp. Penerima melihat rekap tanpa perlu login." },
    ],
  },
  admin: {
    label: "Adminator",
    icon: ShieldCheck,
    steps: [
      { icon: UserPlus, title: "Kelola peserta", desc: "Menu Peserta untuk menambah/mengubah data. Lengkapi tanggal lahir, jenis kelamin, dan status agar penyaringan kegiatan akurat." },
      { icon: KeyRound, title: "Atur hak akses", desc: "Menu Hak Akses untuk memberi peran Pengurus atau Guru/Pengajar, serta mengatur ulang kata sandi." },
      { icon: FileBarChart2, title: "Pantau laporan", desc: "Menu Laporan: pilih rentang tanggal, lalu pakai filter keaktifan (Rajin ≥80%, Cukup 50–79%, Jarang <50%, Belum pernah hadir)." },
      { icon: CalendarDays, title: "Kalender kegiatan", desc: "Menu Kalender menampilkan seluruh jadwal satu bulan; tap tanggal untuk melihat rincian tiap sesi." },
      { icon: HeartHandshake, title: "Tanggapi Ruang Teduh", desc: "Pesan masuk tampil di lonceng notifikasi bersama kegiatan, pengumuman, musyawarah, dan undangan penting." },
    ],
  },
};

const FAQ = [
  { q: "Saya lupa kata sandi, bagaimana?", a: "Pakai tautan Lupa Sandi di halaman masuk bila nomor/email Anda sudah terdaftar. Bila tetap gagal, hubungi pengurus pada daftar kontak di bawah — pengurus dapat mengatur ulang sandi Anda dari menu Hak Akses." },
  { q: "Sandi awal peserta baru apa?", a: "Tanggal lahir dengan format HHBBTTTT tanpa tanda pisah. Contoh lahir 12 Maret 1988 → 12031988. Segera ganti sandi setelah berhasil masuk." },
  { q: "QR saya tidak terbaca saat absen, kenapa?", a: "Naikkan kecerahan layar, bersihkan lensa kamera, dan jaga jarak sekitar 15–20 cm. Bila masih gagal, pengurus bisa mencatat kehadiran Anda lewat Absen Manual." },
  { q: "Kegiatan tidak muncul di daftar saya?", a: "Kegiatan bisa dibatasi jenis kelamin, status pernikahan, kelompok usia, atau daftar peserta terpilih. Pastikan tanggal lahir dan data profil sudah lengkap, lalu minta pengurus memeriksa penyaringan kegiatan." },
  { q: "Bagaimana cara mengajukan izin?", a: "Beri tahu pengurus sebelum kegiatan dimulai; pengurus menandai status Izin pada absensi. Status izin tetap dihitung dalam rekap sebagai izin, bukan alpha." },
  { q: "Kenapa persen kehadiran saya kecil padahal sering datang?", a: "Persen dihitung dari jumlah sesi WAJIB yang Anda ikuti. Satu hari bisa terdiri dari beberapa sesi (pagi/sore/malam) — hadir di satu sesi tidak otomatis tercatat di sesi lain." },
  { q: "Apakah pesan di Ruang Teduh bisa dilihat peserta lain?", a: "Tidak. Pesan hanya dibaca admin dan pengurus, dan Anda boleh mengirim tanpa mencantumkan nama." },
  { q: "Apa beda akun demo dan akun real?", a: "Akun demo memakai database terpisah sehingga bebas dicoba-coba: peserta, kegiatan, dan absensi demo tidak pernah tercampur dengan data real." },
];

export default function BantuanView() {
  const [role, setRole] = useState("peserta");
  const [openFaq, setOpenFaq] = useState(null);
  const [kontak, setKontak] = useState(null);

  useEffect(() => {
    api.get("/bantuan/kontak").then(({ data }) => setKontak(data.items || [])).catch(() => setKontak([]));
  }, []);

  const guide = useMemo(() => GUIDES[role], [role]);

  return (
    <div className="space-y-4" data-testid="bantuan-view">
      <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5 sm:p-6">
        <div className="font-heading text-xl sm:text-2xl font-bold text-[#111827] inline-flex items-center gap-2">
          <LifeBuoy size={22} /> Pusat Bantuan
        </div>
        <p className="text-sm text-[#4B5563] mt-1.5 leading-relaxed max-w-2xl">
          Panduan langkah demi langkah, jawaban pertanyaan yang sering muncul, dan kontak pengurus
          bila masih ada kendala.
        </p>
      </div>

      {/* Panduan langkah */}
      <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5" data-testid="bantuan-panduan">
        <div className="font-bold text-[#111827] inline-flex items-center gap-2">
          <BookOpen size={17} /> Panduan Pemakaian
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(GUIDES).map(([key, g]) => {
            const Icon = g.icon;
            const on = role === key;
            return (
              <button
                key={key}
                data-testid={`bantuan-panduan-${key}`}
                onClick={() => setRole(key)}
                className={`h-10 px-3.5 rounded-xl border-2 text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                  on ? "bg-[#111114] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E8E8E4] hover:border-[#111114] hover:text-[#111114]"
                }`}
              >
                <Icon size={15} /> {g.label}
              </button>
            );
          })}
        </div>
        <ol className="mt-4 space-y-2.5">
          {guide.steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} data-testid={`bantuan-step-${role}-${i}`}
                className="flex gap-3 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3.5">
                <span className="h-9 w-9 shrink-0 rounded-xl bg-[#111114] text-white flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold text-[#111827] text-sm inline-flex items-center gap-1.5">
                    <Icon size={14} className="text-[#4B5563]" /> {s.title}
                  </span>
                  <span className="block text-xs text-[#4B5563] mt-1 leading-relaxed">{s.desc}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Tanya jawab */}
      <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5" data-testid="bantuan-faq">
        <div className="font-bold text-[#111827] inline-flex items-center gap-2">
          <MessageCircleQuestion size={17} /> Tanya Jawab
        </div>
        <div className="mt-3 divide-y divide-[#ECECE8] border border-[#E8E8E4] rounded-xl overflow-hidden">
          {FAQ.map((f, i) => {
            const on = openFaq === i;
            return (
              <div key={i}>
                <button
                  data-testid={`bantuan-faq-${i}`}
                  onClick={() => setOpenFaq(on ? null : i)}
                  className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 ${on ? "bg-[#F4F4F1]" : "hover:bg-[#FAFAF8]"}`}
                >
                  <span className="font-semibold text-sm text-[#111827]">{f.q}</span>
                  <ChevronDown size={17} className={`shrink-0 mt-0.5 text-[#6B7280] transition-transform ${on ? "rotate-180" : ""}`} />
                </button>
                {on && (
                  <p data-testid={`bantuan-faq-answer-${i}`} className="px-4 pb-3.5 text-sm text-[#4B5563] leading-relaxed">
                    {f.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kontak pengurus */}
      <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5" data-testid="bantuan-kontak">
        <div className="font-bold text-[#111827] inline-flex items-center gap-2">
          <PhoneCall size={17} /> Hubungi Pengurus
        </div>
        <p className="text-xs text-[#6B7280] mt-1">
          Daftar diambil otomatis dari akun admin &amp; pengurus yang aktif.
        </p>
        {kontak === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={22} /></div>
        ) : kontak.length === 0 ? (
          <p className="text-sm text-[#6B7280] mt-3">Belum ada kontak pengurus yang tercatat.</p>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {kontak.map((k) => (
              <div key={k.id} data-testid={`bantuan-kontak-${k.id}`}
                className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">{k.role}</span>
                </div>
                <div className="font-semibold text-[#111827] text-sm mt-0.5">{k.name}</div>
                <div className="text-xs text-[#6B7280] mt-0.5">{k.phone || k.whatsapp || "Nomor belum diisi"}</div>
                <div className="flex gap-2 mt-2.5">
                  {k.wa_link && (
                    <a href={k.wa_link} target="_blank" rel="noreferrer"
                      data-testid={`bantuan-kontak-wa-${k.id}`}
                      className="h-9 px-3 rounded-lg bg-[#25D366] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:brightness-95">
                      <Send size={13} /> WhatsApp
                    </a>
                  )}
                  {k.phone && (
                    <a href={`tel:${k.phone}`} data-testid={`bantuan-kontak-tel-${k.id}`}
                      className="h-9 px-3 rounded-lg border-2 border-[#111114] text-[#111114] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F1F1EE]">
                      <PhoneCall size={13} /> Telepon
                    </a>
                  )}
                  {k.email && (
                    <a href={`mailto:${k.email}`} data-testid={`bantuan-kontak-mail-${k.id}`}
                      className="h-9 w-9 rounded-lg border-2 border-[#E8E8E4] text-[#4B5563] inline-flex items-center justify-center hover:border-[#111114] hover:text-[#111114]">
                      <Mail size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
