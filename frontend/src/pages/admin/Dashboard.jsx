import { useEffect, useState } from "react";
import { Users, UserCheck, UserX, Layers, Loader2, CalendarDays } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { todayIndo } from "./adminUtils";

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]" data-testid={`stat-${label}`}>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon size={22} />
        </div>
        <div>
          <div className="text-2xl font-bold text-[#111827] leading-none">{value}</div>
          <div className="text-sm text-[#6B7280] mt-1">{label}</div>
        </div>
      </div>
      {sub && <div className="mt-3 text-sm text-[#6B7280]">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ user }) {
  const [users, setUsers] = useState(null);
  const [kelompok, setKelompok] = useState([]);

  useEffect(() => {
    api.get("/admin/users").then(({ data }) => setUsers(data)).catch(() => setUsers([]));
    api.get("/admin/kelompok").then(({ data }) => setKelompok(data)).catch(() => {});
  }, []);

  if (!users) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={32} /></div>;
  }

  const peserta = users.filter((u) => u.roles?.includes("peserta"));
  const totalPeserta = peserta.length;
  const lakiCount = peserta.filter((u) => u.gender === "L").length;
  const perempuanCount = peserta.filter((u) => u.gender === "P").length;
  const aktif = users.filter((u) => u.status === "active").length;
  const nonaktif = users.filter((u) => u.status === "nonaktif").length;
  const pending = users.filter((u) => u.status === "pending").length;

  const pieData = [
    { name: "Laki-laki", value: lakiCount, color: "#0D5C3A" },
    { name: "Perempuan", value: perempuanCount, color: "#D97706" },
    { name: "Belum diisi", value: totalPeserta - lakiCount - perempuanCount, color: "#CBD5E1" },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-[#111827]">Selamat Datang, {user?.name?.split(" ")[0] || "Admin"}</h1>
        <p className="text-[#6B7280] flex items-center gap-1.5 mt-1"><CalendarDays size={16} /> {todayIndo()}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard icon={Users} label="Total Peserta" value={totalPeserta} color="#0D5C3A"
          sub={`${lakiCount} Laki-laki · ${perempuanCount} Perempuan`} />
        <StatCard icon={UserCheck} label="Akun Aktif" value={aktif} color="#0284C7"
          sub={`${pending} menunggu aktivasi`} />
        <StatCard icon={UserX} label="Akun Nonaktif" value={nonaktif} color="#DC2626" />
        <StatCard icon={Layers} label="Kelompok / Majelis" value={kelompok.length} color="#7C3AED" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="chart-gender">
          <h2 className="font-heading font-bold text-[#111827] mb-2">Komposisi Jenis Kelamin</h2>
          {pieData.length === 0 ? (
            <p className="text-[#6B7280] py-10 text-center">Belum ada data peserta.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="upcoming-activities">
          <h2 className="font-heading font-bold text-[#111827] mb-3">Kegiatan Mendatang</h2>
          <div className="rounded-xl bg-[#F8FAF8] border border-dashed border-[#CBD5E1] p-6 text-center">
            <CalendarDays size={28} className="mx-auto text-[#9CA3AF] mb-2" />
            <p className="text-[#6B7280] text-sm">Modul Kegiatan & Absensi akan aktif pada tahap berikutnya (2C). Statistik kehadiran akan muncul di sini.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
