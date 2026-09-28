// Label peran yang ditampilkan ke pengguna.
export const ROLE_LABEL = {
  admin: "Adminator",
  pengurus: "Pengurus",
  peserta: "Peserta",
};

export function roleLabel(role) {
  return ROLE_LABEL[role] || role;
}

export function rolesLabel(roles = []) {
  return roles.map(roleLabel).join(" · ");
}

// Kelengkapan profil jamaah (dipakai kartu "Lengkapi Profil Kamu").
const PROFILE_FIELDS = [
  ["name", "Nama lengkap"],
  ["gender", "Jenis kelamin"],
  ["dob", "Tanggal lahir"],
  ["birthplace", "Tempat lahir"],
  ["phone", "No. HP"],
  ["whatsapp", "WhatsApp"],
  ["address", "Alamat"],
  ["education", "Pendidikan"],
  ["marital", "Status pernikahan"],
  ["has_photo", "Foto profil"],
];

export function profileCompletion(user) {
  if (!user) return { percent: 0, filled: 0, total: PROFILE_FIELDS.length, missing: [] };
  const missing = PROFILE_FIELDS.filter(([k]) => {
    const v = user[k];
    return k === "has_photo" ? !v : !String(v || "").trim();
  }).map(([, label]) => label);
  const filled = PROFILE_FIELDS.length - missing.length;
  return {
    percent: Math.round((filled / PROFILE_FIELDS.length) * 100),
    filled,
    total: PROFILE_FIELDS.length,
    missing,
  };
}
