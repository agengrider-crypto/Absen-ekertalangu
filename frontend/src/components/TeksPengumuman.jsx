// Teks pengumuman: baris baru dipertahankan, tautan http(s) bisa diklik
// (tab baru). Isi selalu teks biasa — tidak ada HTML yang dieksekusi.
import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const IS_URL = /^https?:\/\//;

export default function TeksPengumuman({ text, className = "" }) {
  const isi = String(text || "");
  if (!isi) return null;
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {isi.split("\n").map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(URL_RE).map((part, pi) => (
            IS_URL.test(part) ? (
              <a key={pi} href={part} target="_blank" rel="noopener noreferrer nofollow"
                className="font-semibold text-[#0E4E31] underline">
                {part}
              </a>
            ) : (
              <Fragment key={pi}>{part}</Fragment>
            )
          ))}
        </Fragment>
      ))}
    </div>
  );
}
