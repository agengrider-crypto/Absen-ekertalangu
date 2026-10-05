// FASE 19 — Halaman Bantuan: panduan langkah, tanya jawab, dan kontak pengurus.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  LifeBuoy, BookOpen, MessageCircleQuestion, PhoneCall, ChevronDown, ScanLine,
  QrCode, ListChecks, CalendarDays, FileBarChart2, HeartHandshake,
  UserPlus, KeyRound, Loader2, Send, Mail, ShieldCheck, Maximize2, X,
} from "lucide-react";
import { api } from "@/lib/api";

const GUIDES = {
  peserta: {
    label: "Peserta",
    icon: QrCode,
    steps: [
      { icon: KeyRound, title: "Masuk ke aplikasi", desc: "Isi email / username / nomor HP, lalu kata sandi. Sandi awal peserta = tanggal lahir format HHBBTTTT (mis. 12031988).", img: "peserta-1-masuk" },
      { icon: QrCode, title: "Tunjukkan QR Saya", desc: "Buka tab QR Saya lalu tunjukkan ke petugas absen. QR ini tetap, jadi aman disimpan sebagai tangkapan layar.", img: "peserta-2-qr" },
      { icon: ScanLine, title: "Absen mandiri (bila dibuka)", desc: "Tab Scan dipakai saat pengurus membagikan barcode kegiatan: arahkan kamera ke barcode, kehadiran langsung tercatat.", img: "peserta-3-scan" },
      { icon: CalendarDays, title: "Lihat jadwal kegiatan", desc: "Tab Kegiatan memuat jadwal yang sesuai dengan data Anda, termasuk kegiatan yang pesertanya dipilih pengurus.", img: "peserta-4-kegiatan" },
      { icon: HeartHandshake, title: "Izin & Ruang Teduh", desc: "Ajukan izin lewat kegiatan terkait, atau kirim keluhan/masukan secara pribadi (boleh tanpa nama) di Ruang Teduh.", img: "peserta-5-ruang-teduh" },
    ],
  },
  pengurus: {
    label: "Pengurus",
    icon: ListChecks,
    steps: [
      { icon: CalendarDays, title: "Buat kegiatan", desc: "Daftar Kegiatan → Tambah Kegiatan. Isi nama, tanggal, jam, pengajar; aktifkan Beberapa waktu bila sehari ada pagi/sore/malam.", img: "pengurus-1-tambah-kegiatan" },
      { icon: ListChecks, title: "Pilih pesertanya", desc: "Saring lewat jenis kelamin, status, dan kelompok usia — atau centang orangnya langsung dengan Pilih peserta tertentu.", img: "pengurus-2-mode-ceklis" },
      { icon: ListChecks, title: "Catat kehadiran manual", desc: "Buka kegiatan → tab Absen Manual untuk menandai hadir/izin satu per satu.", img: "pengurus-3-absen-manual" },
      { icon: ScanLine, title: "Scan barcode peserta", desc: "Tab Scan Barcode memindai QR peserta; kehadiran langsung tercatat pada sesi yang dibuka.", img: "pengurus-4-scan" },
      { icon: QrCode, title: "Tampilkan QR besar", desc: "Menu Scan Presensi → tombol Tampilkan QR Besar. QR tampil layar penuh supaya peserta bisa memindainya langsung dari HP masing-masing.", img: "admin-7-scan-presensi" },
      { icon: FileBarChart2, title: "Bagikan rekap", desc: "Tab Rekap / Laporan menyediakan tautan publik, QR, dan tombol bagikan WhatsApp. Penerima melihat rekap tanpa perlu login.", img: "pengurus-6-rekap" },
    ],
  },
  guru: {
    label: "Guru / Pengajar",
    icon: BookOpen,
    steps: [
      { icon: KeyRound, title: "Masuk ke area Guru", desc: "Setelah masuk, Anda langsung berada di Area Guru. Tombol ganti peran ada di menu profil bila Anda juga peserta/pengurus.", img: "peserta-1-masuk" },
      { icon: BookOpen, title: "Program Pembelajaran", desc: "Kurikulum, materi, dan jadwal per jenjang sedang dirapikan — akan hadir kembali di tab Program Pembelajaran." },
      { icon: ListChecks, title: "Catatan peserta", desc: "Catatan capaian dan hafalan peserta per jenjang menyusul pada pembaruan berikutnya." },
      { icon: HeartHandshake, title: "Butuh bantuan", desc: "Hubungi pengurus lewat daftar kontak di bagian bawah halaman ini." },
    ],
  },
  admin: {
    label: "Adminator",
    icon: ShieldCheck,
    steps: [
      { icon: UserPlus, title: "Kelola peserta", desc: "Menu User untuk menambah/mengubah data. Lengkapi tanggal lahir, jenis kelamin, dan status agar penyaringan kegiatan akurat.", img: "admin-1-peserta" },
      { icon: KeyRound, title: "Atur hak akses", desc: "Menu Hak Akses untuk memberi peran Pengurus atau Guru/Pengajar, serta mengatur ulang kata sandi.", img: "admin-2-hak-akses" },
      { icon: FileBarChart2, title: "Pantau laporan", desc: "Menu Laporan menggabungkan harian & bulanan: pilih periode, lihat pantauan kehadiran, jumlah kegiatan, data peserta, lalu filter keaktifan atau buka detail per peserta.", img: "admin-3-laporan" },
      { icon: CalendarDays, title: "Kalender kegiatan", desc: "Menu Kalender menampilkan seluruh jadwal satu bulan; tap tanggal untuk melihat rincian tiap sesi.", img: "admin-4-kalender" },
      { icon: BookOpen, title: "Program pembelajaran", desc: "Menu Program Pembelajaran sedang dirapikan (segera hadir).", img: "admin-5-program" },
      { icon: HeartHandshake, title: "Pantau notifikasi", desc: "Lonceng memuat pesan Ruang Teduh, kegiatan baru, pengumuman, dan musyawarah dalam satu daftar.", img: "admin-6-notifikasi" },
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

export default function BantuanView({ role: roleProp = "peserta" }) {
  const role = GUIDES[roleProp] ? roleProp : "peserta";
  const [openFaq, setOpenFaq] = useState(null);
  const [kontak, setKontak] = useState(null);
  const [zoom, setZoom] = useState(null);   // tangkapan layar diperbesar

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
          <BookOpen size={17} /> Panduan Pemakaian — {guide.label}
        </div>
        <p className="text-xs text-[#6B7280] mt-1">
          Tiap langkah disertai <b>tangkapan layar asli</b> aplikasi — ketuk gambarnya untuk memperbesar.
        </p>
        <ol className="mt-4 space-y-3">
          {guide.steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} data-testid={`bantuan-step-${role}-${i}`}
                className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3.5">
                <div className="flex gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-xl bg-[#111114] text-white flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold text-[#111827] text-sm inline-flex items-center gap-1.5">
                      <Icon size={14} className="text-[#4B5563]" /> {s.title}
                    </span>
                    <span className="block text-xs text-[#4B5563] mt-1 leading-relaxed">{s.desc}</span>
                  </span>
                </div>
                {s.img && (
                  <button type="button" onClick={() => setZoom({ src: `/panduan/${s.img}.jpg`, title: s.title })}
                    data-testid={`bantuan-ss-${role}-${i}`}
                    className="mt-3 block w-full rounded-xl overflow-hidden border border-[#E8E8E4] bg-white hover:border-[#111114] transition-colors">
                    <img src={`/panduan/${s.img}.jpg`} alt={`Tangkapan layar: ${s.title}`} loading="lazy"
                      className="w-full max-h-72 object-contain object-top bg-white" />
                    <span className="block text-[11px] text-[#6B7280] px-3 py-1.5 text-left">
                      <Maximize2 size={11} className="inline mr-1" /> Ketuk untuk memperbesar — {s.title}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {zoom && createPortal((
        <div className="fixed inset-0 z-[90] bg-[#0B0B0C]/95 flex flex-col items-center justify-center p-4"
          onClick={() => setZoom(null)} data-testid="bantuan-ss-zoom">
          <button data-testid="bantuan-ss-zoom-close"
            className="absolute top-4 right-4 h-11 w-11 rounded-xl bg-white/15 text-white flex items-center justify-center">
            <X size={22} />
          </button>
          <div className="text-white/80 text-sm font-semibold mb-3 text-center px-10">{zoom.title}</div>
          <img src={zoom.src} alt={zoom.title} className="max-h-[80vh] max-w-full rounded-xl bg-white" />
          <p className="text-white/50 text-xs mt-3">Ketuk di mana saja untuk menutup</p>
        </div>
      ), document.body)}

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
