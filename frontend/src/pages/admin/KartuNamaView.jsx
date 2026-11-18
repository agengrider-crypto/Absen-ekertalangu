import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { NameTagView } from "./Peserta";

export default function KartuNamaView() {
  const [users, setUsers] = useState(null);
  const [kelompok, setKelompok] = useState([]);
  const [cetak, setCetak] = useState({});
  const [kartuTautan, setKartuTautan] = useState({});

  const load = useCallback(async () => {
    setUsers(null);
    try {
      const [usersResponse, groupsResponse, cetakResponse, tautanResponse] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/kelompok"),
        api.get("/staff/kartu-cetak"),
        api.get("/staff/kartu-tautan"),
      ]);
      setUsers(usersResponse.data);
      setKelompok(groupsResponse.data);
      setCetak(cetakResponse.data.items || {});
      setKartuTautan(tautanResponse.data.items || {});
    } catch (e) {
      setUsers(false);
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  const muatTautan = useCallback(async () => {
    try {
      const { data } = await api.get("/staff/kartu-tautan");
      setKartuTautan(data.items || {});
    } catch (_) { /* abaikan */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <NameTagView
      users={(users || []).filter((user) => user.roles?.includes("peserta"))}
      kelompok={kelompok}
      cetak={cetak}
      kartuTautan={kartuTautan}
      onKartuTautan={muatTautan}
      onPrinted={load}
      loading={users === null}
      loadError={users === false}
      onRetry={load}
    />
  );
}
