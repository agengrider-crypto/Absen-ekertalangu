/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '18px',
        field: '14px',
        sheet: '28px',
      },
      colors: {
        // ── Token warna E-Kertalangu (sumber: src/lib/theme.js) ──────────────
        brand: { DEFAULT: '#14633F', dark: '#0E4E31' },
        mint: '#E3F3EA',
        paper: '#F6F4EE',
        surface: '#FFFFFF',
        line: '#E7E3D8',
        tile: '#F0EEE6',
        ink: '#14201A',
        mutedink: '#5F6B63',
        fieldline: '#8A948D',
        handle: '#D9D4C5',
        overlay: 'rgba(20,32,26,0.5)',
        status: {
          hadir: { bg: '#E3F3EA', text: '#0E4E31', solid: '#14633F' },
          izin: { bg: '#FBF1D6', text: '#6B4500', solid: '#8A5A00', border: '#EAD596' },
          sakit: { bg: '#E3EEFB', text: '#1D4F91', solid: '#1D4F91' },
          alpa: { bg: '#FBE5E3', text: '#A32A2A', solid: '#A32A2A' },
          akan: { bg: '#E3EEFB', text: '#1D4F91', solid: '#1D4F91' },
          terlaksana: { bg: '#E3F3EA', text: '#0E4E31', solid: '#14633F' },
          selesai: { bg: '#E7E3D8', text: '#4A5650', solid: '#4A5650' },
          perempuan: { bg: '#FBE3EC', text: '#8A1F4B' },
        },
        jenis: {
          rutin: { bg: '#D9F2F4', text: '#0A5961', dot: '#0F7C86' },
          khusus: { bg: '#ECE4FB', text: '#4C2A9B', dot: '#6D3FC8' },
          lain: { bg: '#FFE8DB', text: '#8F3008', dot: '#C2410C' },
        },
        area: {
          admin: { utama: '#14633F', muda: '#E3F3EA', aktif: '#E3F3EA', teks: '#0E4E31' },
          pengurus: { utama: '#1D4F91', muda: '#E3EEFB', aktif: '#E3EEFB', teks: '#1D4F91' },
          peserta: { utama: '#4A5650', muda: '#E7E3D8', aktif: '#F0EEE6', teks: '#3A4540' },
        },
        aksi: { hapus: '#A32A2A' },
        pesan: { gagal: '#A32A2A' },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};