export const Logo = ({ size = 44, showText = true }) => (
  <div className="flex items-center gap-3" data-testid="app-logo">
    <img
      src="/logo.png"
      alt="E-KERTALANGU"
      width={size}
      height={size}
      className="rounded-xl object-contain"
      style={{ width: size, height: size }}
    />
    {showText && (
      <div className="leading-tight">
        <div className="font-heading font-extrabold text-[#0D5C3A] tracking-tight text-lg">
          E-KERTALANGU
        </div>
        <div className="text-xs text-[#6B7280] font-medium">Absensi Pengajian</div>
      </div>
    )}
  </div>
);
