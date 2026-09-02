import { useState } from "react";
import { format, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// value/onChange use ISO "YYYY-MM-DD"; display is DD-MM-YYYY (Indonesian)
export function DateField({ value, onChange, testid, placeholder = "Pilih tanggal", required, className }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const now = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testid}
          className={cn(
            "w-full h-[52px] px-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none transition-colors focus:border-[#0D5C3A] bg-white flex items-center justify-between text-left",
            !selected && "text-[#9CA3AF]",
            className
          )}
        >
          <span>{selected ? format(selected, "dd-MM-yyyy") : placeholder}</span>
          <CalendarIcon size={20} className="text-[#0D5C3A] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
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
          initialFocus
          classNames={{
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "hidden",
            nav: "hidden",
            caption_dropdowns: "flex gap-2 items-center justify-center",
            vhidden: "sr-only",
            dropdown:
              "bg-white border-2 border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm font-semibold text-[#111827] cursor-pointer outline-none focus:border-[#0D5C3A]",
          }}
        />
        {required && !selected && (
          <input tabIndex={-1} required value="" onChange={() => {}} className="sr-only" aria-hidden />
        )}
      </PopoverContent>
    </Popover>
  );
}
