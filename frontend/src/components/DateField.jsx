import { useRef, useState } from "react";
import { format, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// value/onChange use ISO "YYYY-MM-DD"; display is DD/MM/YYYY (Indonesian).
// Klik kolom MAUPUN ikon kalender membuka pemilih tanggal.
export function DateField({ value, onChange, testid, placeholder = "Pilih tanggal", required, className }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const now = new Date();

  const buka = () => {
    setOpen(true);
    // Fokus ke input asli (bisa diketik) setelah popover terbuka.
    setTimeout(() => inputRef.current?.focus?.(), 50);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testid}
          onClick={buka}
          className={cn(
            "w-full h-[52px] px-4 rounded-xl border border-[#8A948D] text-base outline-none transition-colors focus:border-[#14633F] bg-white flex items-center justify-between text-left",
            !selected && "text-[#5F6B63]",
            className
          )}
        >
          <span>{selected ? format(selected, "dd/MM/yyyy") : placeholder}</span>
          <CalendarIcon size={20} className="text-[#0E4E31] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b border-[#E7E3D8] p-2">
          <input
            ref={inputRef}
            type="date"
            value={value || ""}
            max={format(now, "yyyy-MM-dd")}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onChange(v);
            }}
            className="h-10 w-full rounded-lg border border-[#8A948D] bg-white px-2 text-sm text-[#14201A] outline-none focus:border-[#14633F]"
          />
        </div>
        <Calendar
          mode="single"
          locale={idLocale}
          captionLayout="dropdown-buttons"
          fromYear={1930}
          toYear={now.getFullYear()}
          defaultMonth={selected || new Date(1980, 0)}
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          disabled={{ after: now }}
          classNames={{
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "hidden",
            nav: "hidden",
            caption_dropdowns: "flex gap-2 items-center justify-center",
            vhidden: "sr-only",
            dropdown:
              "bg-white border border-[#8A948D] rounded-lg px-2 py-1.5 text-sm font-semibold text-[#14201A] cursor-pointer outline-none focus:border-[#14633F]",
          }}
        />
        {required && !selected && (
          <input tabIndex={-1} required value="" onChange={() => {}} className="sr-only" aria-hidden />
        )}
      </PopoverContent>
    </Popover>
  );
}
