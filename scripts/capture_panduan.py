"""Ambil tangkapan layar asli aplikasi untuk Panduan Bergambar di halaman Bantuan.

Memakai AKUN DEMO supaya tidak ada data real yang terpampang.
Hasil disimpan ke /app/frontend/public/panduan/*.jpg

Jalankan: python3 /app/scripts/capture_panduan.py
"""
import asyncio
import pathlib

from playwright.async_api import async_playwright

BASE = "https://repo-preview-show.preview.emergentagent.com"
# Simpan sementara di /tmp supaya dev-server tidak me-reload halaman saat menulis file.
OUT = pathlib.Path("/tmp/panduan")
FINAL = pathlib.Path("/app/frontend/public/panduan")
OUT.mkdir(parents=True, exist_ok=True)
FINAL.mkdir(parents=True, exist_ok=True)

DESKTOP = {"width": 1440, "height": 900}
MOBILE = {"width": 430, "height": 880}


async def shot(page, name, clip_full=False):
    # beri jeda agar notifikasi/toast sempat hilang dari layar
    await page.wait_for_timeout(1500)
    path = OUT / f"{name}.jpg"
    await page.screenshot(path=str(path), type="jpeg", quality=72, full_page=clip_full)
    print("  →", path.name)


async def login(page, ident, pw, viewport):
    await page.set_viewport_size(viewport)
    await page.goto(BASE, wait_until="networkidle")
    await page.wait_for_timeout(1200)
    await page.fill('[data-testid="input-login-identifier"]', ident)
    await page.fill('[data-testid="input-login-password"]', pw)
    return page


async def nav_admin(page, key):
    """Klik menu sidebar (drawer bila tampilan mobile)."""
    loc = page.locator(f'[data-testid="nav-{key}"]')
    n = await loc.count()
    await loc.nth(n - 1 if n > 1 else 0).click(force=True)
    await page.wait_for_timeout(2500)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # ---------- PESERTA (tampilan HP) ----------
        ctx = await browser.new_context(viewport=MOBILE)
        page = await ctx.new_page()
        await login(page, "demopeserta", "demo1234", MOBILE)
        print("peserta:")
        await shot(page, "peserta-1-masuk")
        await page.click('[data-testid="button-login-submit"]', force=True)
        await page.wait_for_selector('[data-testid="bottomnav-qr"]', timeout=45000)
        await page.wait_for_timeout(9000)   # tunggu toast selamat datang hilang
        await page.click('[data-testid="bottomnav-qr"]', force=True)
        await page.wait_for_timeout(2500)
        await shot(page, "peserta-2-qr")
        await page.click('[data-testid="bottomnav-scan"]', force=True)
        await page.wait_for_timeout(2000)
        await shot(page, "peserta-3-scan")
        await page.click('[data-testid="bottomnav-kegiatan"]', force=True)
        await page.wait_for_timeout(2500)
        await shot(page, "peserta-4-kegiatan")
        await page.click('[data-testid="bottomnav-curhat"]', force=True)
        await page.wait_for_timeout(2000)
        await shot(page, "peserta-5-ruang-teduh")
        await ctx.close()

        # ---------- PENGURUS & ADMIN (tampilan PC) ----------
        ctx = await browser.new_context(viewport=DESKTOP)
        page = await ctx.new_page()
        await login(page, "demo", "demo1234", DESKTOP)
        await page.click('[data-testid="button-login-submit"]', force=True)
        await page.wait_for_timeout(4000)
        await page.wait_for_selector("text=Masuk sebagai Adminator", timeout=45000)
        await page.click("text=Masuk sebagai Adminator", force=True)
        await page.wait_for_selector('[data-testid="nav-kegiatan"]', timeout=45000)
        await page.wait_for_timeout(9000)   # tunggu toast selamat datang hilang

        print("pengurus:")
        await nav_admin(page, "kegiatan")
        await page.click('[data-testid="button-add-kegiatan"]', force=True)
        await page.wait_for_timeout(1800)
        await shot(page, "pengurus-1-tambah-kegiatan")
        await page.click('[data-testid="keg-pick-mode"]', force=True)
        await page.wait_for_timeout(2500)
        await shot(page, "pengurus-2-mode-ceklis")
        await page.click('[data-testid="kegiatan-form-close"]', force=True)
        await page.wait_for_timeout(1000)

        # buka kegiatan pertama
        card = page.locator('[data-testid^="kegiatan-card-open-"]')
        if not await card.count():
            card = page.locator('[data-testid^="kegiatan-card-"]')
        await card.first.click(force=True)
        await page.wait_for_timeout(3500)
        await shot(page, "pengurus-3-absen-manual")
        for tab, name in (("scan", "pengurus-4-scan"), ("undangan", "pengurus-5-undangan"),
                          ("rekap", "pengurus-6-rekap")):
            el = page.locator(f'[data-testid="keg-tab-{tab}"]')
            if await el.count():
                await el.click(force=True)
                await page.wait_for_timeout(2800)
                await shot(page, name)
        back = page.locator('[data-testid="kegiatan-detail-back"]')
        if await back.count():
            await back.click(force=True)
            await page.wait_for_timeout(1500)

        print("admin:")
        await nav_admin(page, "peserta")
        await shot(page, "admin-1-peserta")
        await nav_admin(page, "hakakses")
        await shot(page, "admin-2-hak-akses")
        await nav_admin(page, "laporan")
        toggle = page.locator('[data-testid="laporan-peserta-toggle"]')
        if await toggle.count():
            await toggle.click(force=True)
            await page.wait_for_timeout(1500)
            await page.mouse.wheel(0, 600)
            await page.wait_for_timeout(1200)
        await shot(page, "admin-3-laporan")
        await nav_admin(page, "kalender")
        await shot(page, "admin-4-kalender")
        await nav_admin(page, "program")
        await shot(page, "admin-5-program")
        await page.click('[data-testid="bell-notifikasi"]', force=True)
        await page.wait_for_timeout(1800)
        await shot(page, "admin-6-notifikasi")
        await ctx.close()
        await browser.close()


asyncio.run(main())

import shutil
for f in sorted(OUT.glob("*.jpg")):
    shutil.copy2(f, FINAL / f.name)
print("disalin ke", FINAL)
