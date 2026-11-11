import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Menahan error render di satu bagian halaman agar tidak menjadi layar putih.
 * Dipakai membungkus konten panel admin.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Admin content error:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        data-testid="admin-error-boundary"
        className="rounded-2xl border border-[#E8E8E4] bg-white p-6 text-center"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#991B1B]">
          <AlertTriangle size={20} />
        </div>
        <h2 className="mt-3 font-heading text-base font-bold text-[#111827]">
          Bagian ini gagal ditampilkan
        </h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Terjadi kesalahan saat memuat konten. Silakan muat ulang halaman.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#111114] px-4 text-sm font-semibold text-white hover:brightness-110"
        >
          <RefreshCw size={16} /> Muat ulang
        </button>
      </div>
    );
  }
}
