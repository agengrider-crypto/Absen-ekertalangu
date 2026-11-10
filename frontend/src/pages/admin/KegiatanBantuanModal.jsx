import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, Clock3,
  MapPin, Pause, Play, RotateCcw, Users, Volume2, X,
} from "lucide-react";
import { ACTIVITIES } from "@/constants/testIds";

const STEPS = [
  {
    title: "Mulai dari menu Kegiatan",
    narration: "Tekan Tambah Kegiatan, lalu isi nama dan jenis kegiatan. Ini baru contoh panduan—belum membuat atau mengubah kegiatan di aplikasi Anda.",
  },
  {
    title: "Isi informasi kegiatan",
    narration: "Masukkan pengajar, materi, dan lokasi. Pilih saran yang tersedia atau ketik sendiri. Alamat maupun kata kunci Google Maps juga bisa ditambahkan.",
  },
  {
    title: "Atur tanggal dan jadwal",
    narration: "Pilih tanggal, jam mulai, dan durasi 30 menit, 1 jam, 1,5 jam, atau 2 jam. Atur manual untuk memilih jam selesai sendiri. Jika sehari memiliki beberapa sesi, tentukan jadwal dan peserta wajib untuk tiap sesi. Pengulangan rutin bulanan tersedia untuk 1, 2, 3, 6, atau 12 jadwal.",
  },
  {
    title: "Tentukan peserta",
    narration: "Pilih jenis peserta dan gunakan filter, atau tentukan peserta tertentu. Peserta di luar pilihan wajib tetap dapat terlihat dan tidak otomatis dihitung Alpha.",
  },
  {
    title: "Periksa, lalu simpan",
    narration: "Tinjau lagi informasi kegiatan. Setelah mencentang konfirmasi, tekan Simpan Kegiatan. Kegiatan baru dibuat setelah tombol Simpan ditekan.",
  },
];

const inputClass = "flex h-9 min-w-0 items-center rounded-lg border border-[#E7E3D8] bg-white px-2.5 text-xs text-[#14201A]";

function Field({ label, value, highlighted = false }) {
  return (
    <div className={`min-w-0 ${highlighted ? "rounded-lg ring-2 ring-[#14633F] ring-offset-2" : ""}`}>
      <div className="mb-1 text-[10px] font-semibold text-[#5F6B63]">{label}</div>
      <div className={`${inputClass} truncate`}>{value}</div>
    </div>
  );
}

function PreviewScene({ step }) {
  return (
    <div
      key={step}
      className="flex aspect-video w-full flex-col overflow-hidden rounded-xl border border-[#E7E3D8] bg-white shadow-sm animate-[riseIn_0.32s_ease-out_both] motion-reduce:animate-none"
      aria-label={`Ilustrasi langkah ${step + 1}: ${STEPS[step].title}`}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#E7E3D8] bg-[#F6F4EE] px-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-[#D9D4C5]" />
          <span className="h-2 w-2 rounded-full bg-[#D9D4C5]" />
          <span className="h-2 w-2 rounded-full bg-[#D9D4C5]" />
        </div>
        <span className="text-[10px] font-semibold text-[#5F6B63]">Contoh Formulir Kegiatan</span>
        <span className="w-7" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="truncate text-xs font-bold text-[#14201A] sm:text-sm">{STEPS[step].title}</div>
          <span className="shrink-0 rounded-full bg-[#E3F3EA] px-2 py-1 text-[9px] font-bold text-[#0E4E31]">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <div className="min-h-0 flex-1">
          {step === 0 && (
            <div className="grid h-full content-center gap-2.5 sm:max-w-sm">
              <Field label="Nama kegiatan" value="Kajian Ahad Pagi" highlighted />
              <div>
                <div className="mb-1 text-[10px] font-semibold text-[#5F6B63]">Jenis kegiatan</div>
                <div className="flex gap-2">
                  <span className="rounded-lg bg-[#14633F] px-3 py-1.5 text-[10px] font-semibold text-white">Rutin</span>
                  <span className="rounded-lg border border-[#E7E3D8] px-3 py-1.5 text-[10px] font-semibold text-[#5F6B63]">Khusus</span>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid h-full content-center grid-cols-2 gap-2.5">
              <Field label="Pengajar" value="Ustaz Ahmad" highlighted />
              <Field label="Materi" value="Tafsir Al-Qur'an" />
              <Field label="Lokasi" value="Musholla Kertalangu" />
              <Field label="Alamat Google Maps" value="Majelis Kertalangu" />
            </div>
          )}

          {step === 2 && (
            <div className="grid h-full content-center gap-2.5">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Tanggal kegiatan" value="08 Nov 2026" highlighted />
                <Field label="Jam mulai" value="08.00 WITA" />
                <Field label="Durasi" value="1,5 jam" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Pagi · 08.00–10.00", "Sore · 16.00–17.30"].map((session, index) => (
                  <div key={session} className={`rounded-lg border bg-[#F6F4EE] p-2 ${index === 0 ? "border-[#14633F] ring-2 ring-[#14633F] ring-offset-1" : "border-[#E7E3D8]"}`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#14201A]">
                      <Clock3 size={12} /> {session}
                    </div>
                    <div className="mt-1 text-[9px] text-[#5F6B63]">Peserta wajib sesi ini</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid h-full content-center gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {["Reguler", "Remaja", "Khusus"].map((audience, index) => (
                  <span key={audience} className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${index === 0 ? "bg-[#14633F] text-white" : "border border-[#E7E3D8] text-[#5F6B63]"}`}>
                    {audience}
                  </span>
                ))}
                <span className="rounded-full border border-[#14633F] px-2.5 py-1 text-[9px] font-semibold text-[#0E4E31]">Filter kelompok</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["AH", "Ahmad Hidayat"],
                  ["SN", "Siti Nurhaliza"],
                  ["MR", "Muhammad Ridwan"],
                  ["FA", "Fatimah Azzahra"],
                ].map(([initials, name], index) => (
                  <div key={name} className={`flex min-w-0 items-center gap-2 rounded-lg border bg-white p-2 ${index === 1 ? "border-[#14633F] ring-2 ring-[#14633F] ring-offset-1" : "border-[#E7E3D8]"}`}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[8px] font-bold text-[#0E4E31]">{initials}</span>
                    <span className="truncate text-[9px] font-medium text-[#14201A]">{name}</span>
                    {index === 1 && <Check size={12} className="ml-auto shrink-0 text-[#0E4E31]" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid h-full content-center gap-2.5 sm:max-w-md">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nama kegiatan" value="Kajian Ahad Pagi" />
                <Field label="Tanggal" value="08 Nov 2026" />
                <Field label="Waktu" value="08.00–09.30 WITA" />
                <Field label="Peserta" value="24 peserta" />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[#E3F3EA] bg-[#E3F3EA] p-2 text-[10px] font-semibold text-[#0E4E31]">
                <CircleCheck size={14} /> Informasi sudah ditinjau
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-[#5F6B63]">
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-[#14633F] bg-[#14633F] text-white"><Check size={10} /></span>
                  Saya sudah memeriksa informasi
                </span>
                <span className="rounded-lg bg-[#14633F] px-3 py-2 text-[9px] font-bold text-white">Simpan Kegiatan</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KegiatanBantuanModal({ onClose }) {
  const [step, setStep] = useState(0);
  const [playback, setPlayback] = useState("stopped");
  const [voiceStatus, setVoiceStatus] = useState("Memeriksa suara pada perangkat...");
  const playbackRef = useRef("stopped");
  const voiceRef = useRef(null);
  const animationOnlyRef = useRef(false);
  const playbackTimerRef = useRef(null);
  const speechWatchdogRef = useRef(null);
  const speakStepRef = useRef(null);

  const updatePlayback = useCallback((status) => {
    playbackRef.current = status;
    setPlayback(status);
  }, []);

  const stopSpeechWatchdog = useCallback(() => {
    window.clearInterval(speechWatchdogRef.current);
    speechWatchdogRef.current = null;
  }, []);

  const scheduleAnimationStep = useCallback((stepIndex) => {
    window.clearTimeout(playbackTimerRef.current);
    stopSpeechWatchdog();
    window.speechSynthesis?.cancel();
    animationOnlyRef.current = true;
    setVoiceStatus("Suara perangkat tidak tersedia; animasi tetap berjalan tanpa narasi suara.");
    playbackTimerRef.current = window.setTimeout(() => {
      if (playbackRef.current !== "playing") return;
      if (stepIndex === STEPS.length - 1) {
        updatePlayback("stopped");
        return;
      }
      const nextStep = stepIndex + 1;
      setStep(nextStep);
      speakStepRef.current?.(nextStep);
    }, 7000);
  }, [stopSpeechWatchdog, updatePlayback]);

  const speakStep = (stepIndex) => {
    if (playbackRef.current !== "playing") return;
    if (animationOnlyRef.current) {
      scheduleAnimationStep(stepIndex);
      return;
    }
    const speech = window.speechSynthesis;
    if (!speech || typeof SpeechSynthesisUtterance === "undefined") {
      scheduleAnimationStep(stepIndex);
      return;
    }

    const voices = speech.getVoices();
    const indonesianVoices = voices.filter((voice) => /^id(?:-|$)/i.test(voice.lang));
    const maleVoice = indonesianVoices.find((voice) => /(ardi|\bmale\b|masculine|\bman\b|putra|pria)/i.test(voice.name));
    const voice = maleVoice || indonesianVoices[0] || voices.find((item) => item.default) || voices[0] || voiceRef.current;
    if (maleVoice) setVoiceStatus("Narasi menggunakan suara laki-laki Bahasa Indonesia.");
    else if (indonesianVoices.length) setVoiceStatus("Narasi menggunakan suara Bahasa Indonesia yang tersedia di perangkat.");
    else if (voice) setVoiceStatus("Suara Bahasa Indonesia tidak ditemukan; narasi memakai suara bawaan perangkat.");
    else setVoiceStatus("Meminta suara narasi dari perangkat. Pastikan volume media ponsel tidak senyap.");

    try {
      let utteranceStarted = false;
      const utterance = new SpeechSynthesisUtterance(STEPS[stepIndex].narration);
      utterance.lang = "id-ID";
      utterance.rate = 0.92;
      utterance.pitch = 0.96;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        utteranceStarted = true;
        window.clearTimeout(playbackTimerRef.current);
        if (!indonesianVoices.length && !maleVoice) {
          setVoiceStatus("Narasi sedang dibacakan dengan suara bawaan perangkat.");
        }
        stopSpeechWatchdog();
        speechWatchdogRef.current = window.setInterval(() => {
          if (playbackRef.current === "playing" && !speech.paused) speech.resume();
        }, 10000);
      };
      utterance.onend = () => {
        stopSpeechWatchdog();
        if (playbackRef.current !== "playing") return;
        if (stepIndex === STEPS.length - 1) {
          updatePlayback("stopped");
          return;
        }
        const nextStep = stepIndex + 1;
        setStep(nextStep);
        speakStepRef.current?.(nextStep);
      };
      utterance.onerror = (event) => {
        stopSpeechWatchdog();
        if (event.error === "interrupted" || event.error === "canceled") return;
        scheduleAnimationStep(stepIndex);
      };
      speech.resume();
      speech.speak(utterance);
      playbackTimerRef.current = window.setTimeout(() => {
        if (playbackRef.current === "playing" && !utteranceStarted) scheduleAnimationStep(stepIndex);
      }, 6000);
    } catch {
      scheduleAnimationStep(stepIndex);
    }
  };
  speakStepRef.current = speakStep;

  const moveToStep = useCallback((nextStep) => {
    window.speechSynthesis?.cancel();
    window.clearTimeout(playbackTimerRef.current);
    stopSpeechWatchdog();
    updatePlayback("stopped");
    setStep(Math.max(0, Math.min(nextStep, STEPS.length - 1)));
  }, [stopSpeechWatchdog, updatePlayback]);

  useEffect(() => {
    const speech = window.speechSynthesis;
    if (!speech) {
      setVoiceStatus("Peramban ini tidak mendukung suara narasi.");
      return () => {
        window.clearTimeout(playbackTimerRef.current);
        stopSpeechWatchdog();
      };
    }

    const updateVoices = () => {
      const voices = speech.getVoices();
      const indonesianVoices = voices.filter((voice) => /^id(?:-|$)/i.test(voice.lang));
      const maleVoice = indonesianVoices.find((voice) => /(ardi|\bmale\b|masculine|\bman\b|putra|pria)/i.test(voice.name));
      voiceRef.current = maleVoice || indonesianVoices[0] || voices.find((voice) => voice.default) || voices[0] || null;
      if (maleVoice) setVoiceStatus("Suara laki-laki Bahasa Indonesia tersedia.");
      else if (indonesianVoices.length) setVoiceStatus("Suara Bahasa Indonesia tersedia di perangkat.");
      else if (voiceRef.current) setVoiceStatus("Suara Bahasa Indonesia tidak terdeteksi; narasi akan memakai suara bawaan perangkat.");
      else setVoiceStatus("Daftar suara perangkat belum tersedia; narasi akan mencoba suara bawaan saat diputar.");
    };

    updateVoices();
    speech.addEventListener("voiceschanged", updateVoices);
    return () => {
      speech.removeEventListener("voiceschanged", updateVoices);
      speech.cancel();
      window.clearTimeout(playbackTimerRef.current);
      stopSpeechWatchdog();
    };
  }, [stopSpeechWatchdog]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") moveToStep(step + 1);
      if (event.key === "ArrowLeft") moveToStep(step - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveToStep, onClose, step]);

  const togglePlayback = () => {
    if (playback === "playing") {
      window.speechSynthesis?.pause();
      window.clearTimeout(playbackTimerRef.current);
      stopSpeechWatchdog();
      updatePlayback("paused");
      return;
    }
    if (playback === "paused") {
      updatePlayback("playing");
      if (animationOnlyRef.current) scheduleAnimationStep(step);
      else {
        const speech = window.speechSynthesis;
        speech?.resume();
        playbackTimerRef.current = window.setTimeout(() => {
          if (playbackRef.current === "playing" && !speech?.speaking) scheduleAnimationStep(step);
        }, 6000);
      }
      return;
    }
    const firstStep = step === STEPS.length - 1 ? 0 : step;
    setStep(firstStep);
    animationOnlyRef.current = false;
    updatePlayback("playing");
    speakStep(firstStep);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(20,32,26,0.5)] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="kegiatan-animation-title"
        data-testid={ACTIVITIES.helpModal}
        className="flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#F6F4EE] shadow-2xl sm:max-h-[92vh] sm:max-w-5xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E7E3D8] bg-white px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id="kegiatan-animation-title" className="font-heading text-lg font-bold text-[#14201A]">
              Animasi Panduan: Membuat Kegiatan
            </h2>
            <p className="mt-0.5 text-base text-[#5F6B63]">
              Ikuti langkah-langkahnya, atau putar animasi dari awal sampai akhir.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup animasi panduan"
            title="Tutup jika sudah paham"
            data-testid={ACTIVITIES.helpClose}
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)] sm:p-5">
          <div className="min-w-0">
            <div data-testid={ACTIVITIES.helpAnimation} aria-live="polite">
              <PreviewScene step={step} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                aria-label={playback === "playing" ? "Jeda animasi" : playback === "paused" ? "Lanjutkan narasi" : step === STEPS.length - 1 ? "Putar ulang animasi dengan narasi" : "Putar animasi dengan narasi"}
                data-testid={ACTIVITIES.helpPlay}
                onClick={togglePlayback}
                className="inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-base font-semibold text-white hover:bg-[#0E4E31]"
              >
                {playback === "playing" ? <Pause size={17} /> : step === STEPS.length - 1 ? <RotateCcw size={17} /> : <Play size={17} />}
                {playback === "playing" ? "Jeda" : playback === "paused" ? "Lanjutkan" : step === STEPS.length - 1 ? "Putar lagi" : "Putar"}
              </button>
              <button
                type="button"
                aria-label="Langkah sebelumnya"
                data-testid={ACTIVITIES.helpPrevious}
                onClick={() => moveToStep(step - 1)}
                disabled={step === 0}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#E7E3D8] bg-white text-[#0E4E31] disabled:opacity-40"
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                aria-label="Langkah berikutnya"
                data-testid={ACTIVITIES.helpNext}
                onClick={() => moveToStep(step + 1)}
                disabled={step === STEPS.length - 1}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#E7E3D8] bg-white text-[#0E4E31] disabled:opacity-40"
              >
                <ChevronRight size={19} />
              </button>
              <div className="ml-auto min-w-0 text-right text-sm font-semibold text-[#5F6B63]" aria-live="polite">
                Langkah {step + 1} dari {STEPS.length}
              </div>
            </div>
            <div role="group" aria-label="Pilih langkah animasi" className="mt-3 flex gap-1.5">
              {STEPS.map((item, index) => (
                <button
                  type="button"
                  key={item.title}
                  aria-label={`Lihat langkah ${index + 1}: ${item.title}`}
                  aria-current={index === step ? "step" : undefined}
                  data-testid={`${ACTIVITIES.helpStep}-${index + 1}`}
                  onClick={() => moveToStep(index)}
                  className={`h-2 flex-1 rounded-full transition-colors ${index <= step ? "bg-[#14633F]" : "bg-[#E7E3D8]"}`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-[#5F6B63]">
              Contoh animasi—tidak mengubah atau menyimpan data kegiatan Anda.
            </p>
            <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-[#5F6B63]" role="status" aria-live="polite">
              <Volume2 size={15} className="mt-0.5 shrink-0" /> {voiceStatus}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#5F6B63]">
              Jika belum terdengar, naikkan volume media ponsel dan pastikan suara pada peramban tidak dibisukan.
            </p>
          </div>

          <section
            aria-labelledby="kegiatan-narration-title"
            data-testid={ACTIVITIES.helpNarration}
            className="rounded-2xl border border-[#E7E3D8] bg-white p-4"
          >
            <h3 id="kegiatan-narration-title" className="mb-3 inline-flex items-center gap-2 font-bold text-[#14201A]">
              <Play size={16} /> Naskah Narasi
            </h3>
            <div key={step} className="rounded-xl bg-[#F6F4EE] p-4 animate-[riseIn_0.32s_ease-out_both] motion-reduce:animate-none">
              <h4 className="text-base font-bold text-[#0E4E31]">{STEPS[step].title}</h4>
              <p className="mt-2 text-base leading-relaxed text-[#5F6B63]">{STEPS[step].narration}</p>
              {step === 2 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#E7E3D8] bg-white p-2.5 text-sm text-[#5F6B63]">
                  <CalendarDays size={15} /> <Clock3 size={15} /> Sesi pagi dan sore
                </div>
              )}
              {step === 3 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#E7E3D8] bg-white p-2.5 text-sm text-[#5F6B63]">
                  <Users size={15} /> Peserta dipilih sesuai kebutuhan
                </div>
              )}
              {step === 1 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#E7E3D8] bg-white p-2.5 text-sm text-[#5F6B63]">
                  <MapPin size={15} /> Saran isian dan lokasi Google Maps
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {STEPS.map((item, index) => (
                <button
                  type="button"
                  key={item.title}
                  onClick={() => moveToStep(index)}
                  data-testid={`${ACTIVITIES.helpNarrationStep}-${index + 1}`}
                  aria-current={index === step ? "step" : undefined}
                  className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${index === step ? "border-[#14633F] bg-[#14633F] text-white" : "border-[#E7E3D8] bg-white text-[#5F6B63]"}`}
                >
                  {index + 1}. {item.title.split(" ").slice(0, 3).join(" ")}
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
