import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { NameTagView } from "./Peserta";

export default function KartuNamaView() {
  const [users, setUsers] = useState(null);
  const [kelompok, setKelompok] = useState([]);

  const load = useCallback(async () => {
    setUsers(null);
    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/kelompok"),
      ]);
      setUsers(usersResponse.data);
      setKelompok(groupsResponse.data);
    } catch (e) {
      setUsers(false);
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <NameTagView
      users={(users || []).filter((user) => user.roles?.includes("peserta"))}
      kelompok={kelompok}
      loading={users === null}
      loadError={users === false}
      onRetry={load}
    />
  );
}
