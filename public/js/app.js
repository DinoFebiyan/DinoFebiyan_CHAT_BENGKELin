/* ============ UTIL ============ */
function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', Boolean(isError));
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* Kategori jasa: ketersediaan boolean (Tersedia/Tidak), bukan jumlah stok */
const SERVICE_CATS = ['Jasa Bengkel', 'Kunci Serep'];
function isService(kategori) {
  return SERVICE_CATS.includes(kategori);
}

/* Gambar default per kategori (file lokal, tanpa emoji/SVG) */
const CATEGORY_IMAGES = {
  'Jasa Bengkel': '/image/TeknisiPerbaikan.jpg',
  'Bahan Bakar': '/image/bensin.jpg',
  'Kunci Serep': '/image/kunci.jpg',
  'Suku Cadang & Oli': '/image/OliShell.jpg',
};
function itemImage(item) {
  return item.image_url || CATEGORY_IMAGES[item.kategori] || CATEGORY_IMAGES['Jasa Bengkel'];
}

function availabilityLabel(item) {
  if (isService(item.kategori)) return item.stok > 0 ? 'Tersedia' : 'Tidak Tersedia';
  return item.stok > 0 ? `Stok ${item.stok}` : 'Habis';
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============ STATE ============ */
const state = {
  user: null,
  kategori: [],
  catalog: [],
  myItems: [],
  currentView: 'catalog',
};

const views = {
  catalog: 'viewCatalog',
  bengkel: 'viewBengkel',
  admin: 'viewAdmin',
};

const $ = (id) => document.getElementById(id);

function currentRole() {
  return state.user ? state.user.role : 'guest';
}

/* ============ NAVBAR ============ */
const BRAND_SVG = `<div class="brand-icon" aria-hidden="true">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
</div>`;

/* ============ TOGGLE TAMPILKAN PASSWORD (tanda mata) ============ */
document.querySelectorAll('.pw-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.querySelector('.eye-open').classList.toggle('hidden', show);
    btn.querySelector('.eye-off').classList.toggle('hidden', !show);
    btn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });
});

function resetPasswordVisibility() {
  document.querySelectorAll('.pw-toggle').forEach((btn) => {
    const input = document.getElementById(btn.dataset.target);
    if (input) input.type = 'password';
    btn.querySelector('.eye-open').classList.remove('hidden');
    btn.querySelector('.eye-off').classList.add('hidden');
  });
}

function renderNav() {
  const navRight = $('navRight');
  if (state.user) {
    navRight.innerHTML = `
      <div class="nav-user">
        <span class="nav-user-name" title="${escapeHTML(state.user.nama)}">${escapeHTML(state.user.nama)}</span>
        <span class="uc-role">${escapeHTML(state.user.role)}</span>
      </div>
      <button type="button" class="btn-logout" id="btnLogout">Keluar</button>`;
    $('btnLogout').addEventListener('click', doLogout);
  } else {
    navRight.innerHTML = `<button type="button" class="btn-nav" id="btnGoLogin">Masuk / Daftar Mitra</button>`;
    $('btnGoLogin').addEventListener('click', () => showAuth('login'));
  }
}

function switchView(view) {
  state.currentView = view;
  Object.entries(views).forEach(([key, id]) => {
    const el = $(id);
    el.classList.toggle('hidden', key !== view);
    if (key === view) {
      el.classList.remove('view-anim');
      void el.offsetWidth; /* restart animasi */
      el.classList.add('view-anim');
    }
  });
  if (view === 'catalog') loadCatalog();
  if (view === 'bengkel') loadBengkelDashboard();
  if (view === 'admin') loadAdminPanel();
  renderNav();
  window.scrollTo(0, 0);
}

/* ============ AUTH OVERLAY ============ */
function showAuth(tab) {
  $('authScreen').classList.remove('hidden');
  if (tab === 'register') {
    $('tabRegister').click();
  } else {
    $('tabLogin').click();
  }
}

function hideAuth() {
  $('authScreen').classList.add('hidden');
  showLoginError('');
}

async function doLogout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  state.user = null;
  switchView('catalog');
  showToast('Anda telah keluar.');
}

$('tabLogin').addEventListener('click', () => {
  $('tabLogin').classList.add('active');
  $('tabRegister').classList.remove('active');
  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');
  showLoginError('');
});

$('tabRegister').addEventListener('click', () => {
  $('tabRegister').classList.add('active');
  $('tabLogin').classList.remove('active');
  $('registerForm').classList.remove('hidden');
  $('loginForm').classList.add('hidden');
});

$('authClose').addEventListener('click', hideAuth);

$('authScreen').addEventListener('click', (e) => {
  if (e.target === $('authScreen')) hideAuth();
});

function showLoginError(message) {
  const box = $('loginError');
  if (!message) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.textContent = message;
  box.classList.remove('hidden');
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoginError('');
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email: $('loginEmail').value.trim(), password: $('loginPassword').value },
    });
    state.user = data.user;
    showApp();
    showToast('Selamat datang, ' + data.user.nama.split(' ')[0] + '!');
  } catch (err) {
    showLoginError(err.message || 'Login gagal. Periksa email dan password Anda.');
  }
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('regPassword').value !== $('regPassword2').value) {
    showToast('Konfirmasi password tidak cocok dengan password.', true);
    $('regPassword2').focus();
    return;
  }
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: {
        nama_akun: $('regNamaAkun').value.trim(),
        nama_bengkel: $('regNamaBengkel').value.trim(),
        email: $('regEmail').value.trim(),
        password: $('regPassword').value,
        nomor_wa: $('regWa').value,
        alamat: $('regAlamat').value.trim(),
      },
    });
    showToast(data.message || 'Pendaftaran berhasil! Tunggu persetujuan admin.');
    hideAuth();
    $('registerForm').reset();
    resetPasswordVisibility();
  } catch (err) {
    showToast(err.message, true);
  }
});

function showApp() {
  hideAuth();
  const start = currentRole() === 'admin' ? 'admin' : currentRole() === 'bengkel' ? 'bengkel' : 'catalog';
  switchView(start);
}

/* ============ KATALOG (PUBLIK) ============ */
async function loadCatalog() {
  try {
    const q = $('searchInput').value.trim();
    const kategori = $('categoryFilter').value;
    const sort = $('sortSelect').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (kategori && kategori !== 'ALL') params.set('kategori', kategori);
    if (sort && sort !== 'default') params.set('sort', sort);

    const data = await api('/api/items?' + params.toString());
    state.catalog = data.items;
    if (data.kategori) {
      state.kategori = data.kategori;
      const sel = $('categoryFilter');
      const current = sel.value;
      sel.innerHTML =
        '<option value="ALL">Semua kategori</option>' +
        data.kategori.map((k) => `<option value="${escapeHTML(k)}">${escapeHTML(k)}</option>`).join('');
      sel.value = current && [...sel.options].some((o) => o.value === current) ? current : 'ALL';
      renderFooterKategori();
    }
    renderCatalog();
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderCatalog() {
  const grid = $('catalogGrid');
  if (!state.catalog.length) {
    grid.innerHTML = `<div class="empty-catalog">Layanan atau produk tidak ditemukan. Coba kata kunci lain.</div>`;
    return;
  }

  grid.innerHTML = state.catalog
    .map((item, idx) => {
      return `
        <article class="product-card" data-id="${item.id}" tabindex="0" style="animation-delay:${Math.min(idx * 45, 360)}ms" aria-label="Lihat detail ${escapeHTML(item.nama)}">
          <div class="card-media">
            <img src="${escapeHTML(itemImage(item))}" alt="${escapeHTML(item.nama)}" loading="lazy" />
          </div>
          <div class="card-content">
            <span class="badge-cat">${escapeHTML(item.kategori)}</span>
            <h3 class="card-title">${escapeHTML(item.nama)}</h3>
            <div class="card-price-label">Harga</div>
            <div class="card-price">${formatRupiah(item.harga)}</div>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('click', () => {
      const item = state.catalog.find((i) => String(i.id) === card.dataset.id);
      if (item) openItemModal(item);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = state.catalog.find((i) => String(i.id) === card.dataset.id);
        if (item) openItemModal(item);
      }
    });
  });
}

/* ============ MODAL DETAIL LAYANAN ============ */
function buildWhatsAppUrl(item) {
  const riderName = $('riderName').value.trim() || 'Pengendara';
  const riderLocation = $('riderLocation').value.trim() || 'Belum diisi (akan kirim shareloc)';
  const phone = (item ? item.nomor_wa : sosPhone()) || '6281234567890';

  const serviceText = item
    ? `*Layanan/Produk:* ${item.nama} (${formatRupiah(item.harga)})\n*Mitra:* ${item.nama_bengkel}`
    : `*Layanan/Produk:* BANTUAN DARURAT CEPAT (SOS)`;

  const text = [
    `Halo Mitra *BENGKELIN!*, saya butuh bantuan kendaraan:`,
    ``,
    serviceText,
    `*Pemesan/Kendaraan:* ${riderName}`,
    `*Patokan Lokasi:* ${riderLocation}`,
    ``,
    `Mohon konfirmasi ketersediaan & estimasi tiba. Terima kasih!`,
  ].join('\n');

  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
}

function sosPhone() {
  const first = state.catalog[0];
  return first ? first.nomor_wa : '';
}

function openItemModal(item) {
  $('modalImage').src = itemImage(item);
  $('modalImage').alt = item.nama;
  $('modalCat').textContent = item.kategori;
  $('modalName').textContent = item.nama;
  $('modalDesc').textContent = item.deskripsi;
  $('modalPrice').textContent = formatRupiah(item.harga);

  const stockEl = $('modalStock');
  const isOut = item.stok <= 0;
  stockEl.textContent = availabilityLabel(item);
  stockEl.classList.toggle('empty', isOut);

  $('modalShop').textContent = item.nama_bengkel;
  $('modalAddress').textContent = item.alamat || '';

  const orderBtn = $('modalOrderBtn');
  orderBtn.disabled = isOut;
  orderBtn.textContent = isOut ? (isService(item.kategori) ? 'Jasa Tidak Tersedia' : 'Stok Habis') : 'Pesan via WhatsApp';
  $('modalHint').classList.toggle('hidden', isOut);

  orderBtn.onclick = () => {
    if (item.stok <= 0) return;
    window.open(buildWhatsAppUrl(item), '_blank', 'noopener,noreferrer');
  };

  $('itemModal').classList.remove('hidden');
  $('itemModal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeItemModal() {
  $('itemModal').classList.add('hidden');
  $('itemModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

$('modalClose').addEventListener('click', closeItemModal);
$('itemModal').addEventListener('click', (e) => {
  if (e.target === $('itemModal')) closeItemModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('itemModal').classList.contains('hidden')) closeItemModal();
    if (!$('emergencyModal').classList.contains('hidden')) closeEmergencyModal();
    if (!$('authScreen').classList.contains('hidden')) hideAuth();
  }
});

$('searchInput').addEventListener('input', loadCatalog);
$('categoryFilter').addEventListener('change', loadCatalog);
$('sortSelect').addEventListener('change', loadCatalog);

/* ============ PANGGIL DARURAT (mitra terlama = terpercaya) ============ */
let emergencyBengkel = null;

function buildEmergencyMessage() {
  const riderName = $('riderName').value.trim() || 'Pengendara';
  const riderLocation = $('riderLocation').value.trim() || 'Belum diisi (akan kirim shareloc)';
  return [
    `Halo Mitra *BENGKELIN!* (${emergencyBengkel.nama_bengkel}), saya butuh BANTUAN DARURAT kendaraan:`,
    ``,
    `*Pemesan/Kendaraan:* ${riderName}`,
    `*Patokan Lokasi:* ${riderLocation}`,
    `*Kondisi:* Saya belum yakin kerusakannya, mohon bantuan pemeriksaan di lokasi.`,
    ``,
    `Mohon segera datang & konfirmasi estimasi tiba. Terima kasih!`,
  ].join('\n');
}

async function openEmergencyModal() {
  try {
    const data = await api('/api/emergency-bengkel');
    emergencyBengkel = data.bengkel;
    const since = new Date(emergencyBengkel.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    $('emgShopInfo').innerHTML = `
      <strong>${escapeHTML(emergencyBengkel.nama_bengkel)}</strong>
      <span>Mitra terlama — bergabung sejak ${since}</span>`;
    $('emgMessage').value = buildEmergencyMessage();
    $('emergencyModal').classList.remove('hidden');
    $('emergencyModal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast(err.message, true);
  }
}

function closeEmergencyModal() {
  $('emergencyModal').classList.add('hidden');
  $('emergencyModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

$('btnEmergency').addEventListener('click', openEmergencyModal);
$('emgClose').addEventListener('click', closeEmergencyModal);
$('emergencyModal').addEventListener('click', (e) => {
  if (e.target === $('emergencyModal')) closeEmergencyModal();
});

$('emgSendBtn').addEventListener('click', () => {
  if (!emergencyBengkel) return;
  const phone = emergencyBengkel.nomor_wa.replace(/[^0-9]/g, '');
  const text = $('emgMessage').value.trim() || buildEmergencyMessage();
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  closeEmergencyModal();
});

$('searchInput').addEventListener('input', loadCatalog);
function renderFooterKategori() {
  const ul = $('footerKategori');
  ul.innerHTML = state.kategori
    .map((k) => `<li><a href="#" data-kat="${escapeHTML(k)}">${escapeHTML(k)}</a></li>`)
    .join('');
  ul.querySelectorAll('[data-kat]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.user) return showToast('Keluar akun dulu untuk melihat katalog publik.');
      switchView('catalog');
      $('categoryFilter').value = a.dataset.kat;
      loadCatalog();
      window.scrollTo(0, 0);
    })
  );
}

$('footerJadiMitra').addEventListener('click', (e) => {
  e.preventDefault();
  if (state.user) return showToast('Anda sudah masuk sebagai ' + state.user.role + '.');
  showAuth('register');
});

$('footerMasuk').addEventListener('click', (e) => {
  e.preventDefault();
  if (state.user) return showToast('Anda sudah masuk sebagai ' + state.user.role + '.');
  showAuth('login');
});

$('footerLogo').addEventListener('click', (e) => {
  e.preventDefault();
  $('brandHome').click();
});

/* ============ DASHBOARD BENGKEL ============ */
let uploadedImageDataUrl = '';

async function loadBengkelDashboard() {
  try {
    const [meData, itemData] = await Promise.all([
      api('/api/auth/me'),
      api('/api/my-items'),
    ]);
    if (meData.user) {
      state.user = { ...state.user, ...meData.user };
      renderBengkelBanner(meData.user.status);
      $('pfNamaAkun').value = meData.user.nama || '';
      $('pfNamaBengkel').value = meData.user.namaBengkel || '';
      $('pfAlamat').value = meData.user.alamat || '';
      $('pfWa').value = meData.user.nomorWa || '';
      $('pfEmail').value = meData.user.email || '';
    }
    state.myItems = itemData.items;
    if (itemData.kategori) state.kategori = itemData.kategori;
    fillKategoriSelect($('itemCategory'));
    toggleStokField();
    renderBengkelStats();
    renderBengkelTable();
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderBengkelBanner(status) {
  const banner = $('bengkelStatusBanner');
  if (status === 'active') {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden', 'error');
  if (status === 'pending') {
    banner.textContent = 'Pendaftaran bengkel Anda masih MENUNGGU PERSETUJUAN admin. Katalog Anda belum tampil di halaman publik.';
  } else {
    banner.classList.add('error');
    banner.textContent = 'Pendaftaran bengkel Anda DITOLAK oleh admin. Hubungi admin untuk informasi lebih lanjut.';
  }
}

function renderBengkelStats() {
  const items = state.myItems;
  const totalReady = items.filter((i) => i.stok > 0).length;
  const totalStock = items.reduce((acc, i) => acc + Number(i.stok || 0), 0);
  const totalCats = new Set(items.map((i) => i.kategori)).size;

  $('bengkelStatsGrid').innerHTML = `
    <div class="stat-card"><span>Total Layanan / Produk</span><strong>${items.length}</strong></div>
    <div class="stat-card"><span>Layanan Siap / Tersedia</span><strong>${totalReady}</strong></div>
    <div class="stat-card"><span>Total Stok Produk</span><strong>${totalStock}</strong></div>
    <div class="stat-card"><span>Kategori Aktif</span><strong>${totalCats}</strong></div>
  `;
}

function renderBengkelTable() {
  const tbody = $('bengkelTableBody');
  if (!state.myItems.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Belum ada layanan. Tambahkan layanan pertama Anda.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.myItems
    .map((item) => {
      const thumb = `<img src="${escapeHTML(itemImage(item))}" alt="${escapeHTML(item.nama)}" />`;
      return `
        <tr>
          <td data-label="Layanan">
            <div class="item-cell">
              <div class="table-thumb">${thumb}</div>
              <strong>${escapeHTML(item.nama)}</strong>
            </div>
          </td>
          <td data-label="Kategori">${escapeHTML(item.kategori)}</td>
          <td data-label="Harga">${formatRupiah(item.harga)}</td>
          <td data-label="Ketersediaan"><span class="status-pill ${item.stok > 0 ? 'active' : 'rejected'}">${availabilityLabel(item)}</span></td>
          <td data-label="Aksi">
            <div class="action-btns">
              <button type="button" class="btn btn-outline btn-sm" data-edit="${item.id}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-del="${item.id}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => startEditItem(b.dataset.edit))
  );
  tbody.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteItem(b.dataset.del))
  );
}

/* Simpan Informasi Bengkel (nama pemilik, nama bengkel, alamat, WA, email, password opsional) */
$('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/bengkel-profile', {
      method: 'PUT',
      body: {
        nama: $('pfNamaAkun').value.trim(),
        nama_bengkel: $('pfNamaBengkel').value.trim(),
        alamat: $('pfAlamat').value.trim(),
        nomor_wa: $('pfWa').value,
        email: $('pfEmail').value.trim(),
        password: $('pfPassword').value,
      },
    });
    $('pfWa').value = data.nomor_wa;
    $('pfEmail').value = data.email;
    $('pfPassword').value = '';
    state.user = {
      ...state.user,
      nama: data.nama,
      nomorWa: data.nomor_wa,
      email: data.email,
      namaBengkel: $('pfNamaBengkel').value.trim(),
    };
    renderNav();
    showToast(
      data.password_changed
        ? 'Informasi bengkel & password berhasil diperbarui.'
        : 'Informasi bengkel berhasil diperbarui.'
    );
  } catch (err) {
    showToast(err.message, true);
  }
});

/* Toggle field ketersediaan: kategori jasa -> checkbox Tersedia, produk -> input stok */
function toggleStokField() {
  const isSvc = isService($('itemCategory').value);
  $('fieldStok').classList.toggle('hidden', isSvc);
  $('fieldTersedia').classList.toggle('hidden', !isSvc);
  $('itemStock').required = !isSvc;
  if (isSvc) $('itemStock').value = $('itemTersedia').checked ? '1' : '0';
}

$('itemCategory').addEventListener('change', toggleStokField);
$('itemTersedia').addEventListener('change', () => {
  if (isService($('itemCategory').value)) $('itemStock').value = $('itemTersedia').checked ? '1' : '0';
});

/* Upload gambar */
$('itemImageFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    uploadedImageDataUrl = await compressImage(file);
    showImagePreview(uploadedImageDataUrl);
    showToast('Gambar berhasil dimuat.');
  } catch {
    showToast('Gagal memuat gambar.', true);
  }
});

function showImagePreview(src) {
  const wrap = $('imagePreviewContainer');
  const img = $('imagePreview');
  if (src) {
    img.src = src;
    wrap.classList.remove('hidden');
  } else {
    img.src = '';
    wrap.classList.add('hidden');
  }
}

$('btnClearImage').addEventListener('click', () => {
  uploadedImageDataUrl = '';
  $('itemImageFile').value = '';
  showImagePreview('');
});

function fillKategoriSelect(selectEl) {
  selectEl.innerHTML = state.kategori
    .map((k) => `<option value="${escapeHTML(k)}">${escapeHTML(k)}</option>`)
    .join('');
}

/* Submit tambah/edit layanan */
$('itemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('itemId').value;
  const kategori = $('itemCategory').value;
  const stok = isService(kategori) ? ($('itemTersedia').checked ? 1 : 0) : Math.max(0, Math.floor(Number($('itemStock').value) || 0));

  const payload = {
    nama: $('itemName').value.trim(),
    kategori,
    harga: Math.max(0, Number($('itemPrice').value) || 0),
    stok,
    deskripsi: $('itemDesc').value.trim(),
    image_url: uploadedImageDataUrl,
  };

  try {
    await api(id ? `/api/items/${id}` : '/api/items', {
      method: id ? 'PUT' : 'POST',
      body: payload,
    });
    showToast(id ? 'Layanan berhasil diperbarui.' : 'Layanan baru berhasil ditambahkan.');
    resetItemForm();
    await loadBengkelDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
});

function startEditItem(id) {
  const item = state.myItems.find((i) => String(i.id) === String(id));
  if (!item) return;
  $('formHeading').textContent = 'Edit Layanan / Produk';
  $('itemId').value = item.id;
  $('itemName').value = item.nama;
  $('itemCategory').value = item.kategori;
  $('itemPrice').value = item.harga;
  $('itemDesc').value = item.deskripsi;

  if (isService(item.kategori)) {
    $('itemTersedia').checked = item.stok > 0;
    $('itemStock').value = item.stok > 0 ? '1' : '0';
  } else {
    $('itemStock').value = item.stok;
  }
  toggleStokField();

  uploadedImageDataUrl = item.image_url || '';
  showImagePreview(uploadedImageDataUrl);
  $('btnCancelEdit').classList.remove('hidden');
  $('itemForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetItemForm() {
  $('itemForm').reset();
  $('itemId').value = '';
  $('formHeading').textContent = 'Tambah Layanan / Produk';
  $('btnCancelEdit').classList.add('hidden');
  uploadedImageDataUrl = '';
  showImagePreview('');
  toggleStokField();
}

$('btnCancelEdit').addEventListener('click', resetItemForm);

async function deleteItem(id) {
  if (!confirm('Hapus layanan ini dari katalog?')) return;
  try {
    await api(`/api/items/${id}`, { method: 'DELETE' });
    showToast('Layanan berhasil dihapus.');
    if ($('itemId').value === String(id)) resetItemForm();
    await loadBengkelDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ============ PANEL ADMIN ============ */
async function loadAdminPanel() {
  try {
    const [bk, st] = await Promise.all([
      api('/api/admin/bengkel'),
      api('/api/admin/stats'),
    ]);
    $('adminStatsGrid').innerHTML = `
      <div class="stat-card"><span>Mitra Bengkel Aktif</span><strong>${st.stats.total_bengkel}</strong></div>
      <div class="stat-card"><span>Menunggu Persetujuan</span><strong>${st.stats.total_pending}</strong></div>
      <div class="stat-card"><span>Total Layanan Katalog</span><strong>${st.stats.total_layanan}</strong></div>
      <div class="stat-card"><span>Total Stok & Slot</span><strong>${st.stats.total_stok}</strong></div>
    `;
    renderAdminBengkelTable(bk.bengkel);
  } catch (err) {
    showToast(err.message, true);
  }
}

const STATUS_LABEL = {
  pending: 'Menunggu',
  active: 'Mitra Aktif',
  rejected: 'Ditolak',
  suspended: 'Nonaktif',
};

function renderAdminBengkelTable(list) {
  const tbody = $('adminTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Belum ada mitra bengkel.</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (b) => `
      <tr>
        <td data-label="Bengkel">
          <strong>${escapeHTML(b.nama_bengkel)}</strong><br />
          <span class="shop-sub">${escapeHTML(b.alamat || '—')}</span>
        </td>
        <td data-label="Pemilik">
          ${escapeHTML(b.nama_akun)}<br />
          <span class="shop-sub">${escapeHTML(b.email)}</span>
        </td>
        <td data-label="WhatsApp">${escapeHTML(b.nomor_wa)}</td>
        <td data-label="Layanan">${b.total_layanan} item<br /><span class="shop-sub">stok ${b.total_stok}</span></td>
        <td data-label="Status"><span class="status-pill ${escapeHTML(b.status)}">${STATUS_LABEL[b.status] || escapeHTML(b.status)}</span></td>
        <td data-label="Aksi">
          <div class="action-btns">
            ${
              b.status === 'pending' || b.status === 'rejected'
                ? `<button type="button" class="btn btn-ok btn-sm" data-status="${b.id}" data-val="active">Setujui</button>
                   ${b.status === 'pending' ? `<button type="button" class="btn btn-outline btn-sm" data-status="${b.id}" data-val="rejected">Tolak</button>` : ''}`
                : b.status === 'active'
                  ? `<button type="button" class="btn btn-outline btn-sm" data-status="${b.id}" data-val="suspended">Nonaktifkan</button>`
                  : `<button type="button" class="btn btn-ok btn-sm" data-status="${b.id}" data-val="active">Aktifkan</button>`
            }
            <button type="button" class="btn btn-danger btn-sm" data-delbengkel="${b.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-status]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const val = btn.dataset.val;
      try {
        await api(`/api/admin/bengkel/${btn.dataset.status}/status`, {
          method: 'PUT',
          body: { status: val },
        });
        const msg = {
          active: 'Bengkel disetujui & diaktifkan.',
          rejected: 'Pendaftaran bengkel ditolak.',
          suspended: 'Bengkel dinonaktifkan — katalog disembunyikan dari publik.',
        };
        showToast(msg[val] || 'Status bengkel diperbarui.');
        loadAdminPanel();
      } catch (err) {
        showToast(err.message, true);
      }
    })
  );

  tbody.querySelectorAll('[data-delbengkel]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus bengkel ini beserta akun dan seluruh katalognya?')) return;
      try {
        await api(`/api/admin/bengkel/${btn.dataset.delbengkel}`, { method: 'DELETE' });
        showToast('Bengkel berhasil dihapus.');
        loadAdminPanel();
      } catch (err) {
        showToast(err.message, true);
      }
    })
  );
}

$('bengkelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/bengkel', {
      method: 'POST',
      body: {
        nama_akun: $('bkNamaAkun').value.trim(),
        email: $('bkEmail').value.trim(),
        password: $('bkPassword').value,
        nama_bengkel: $('bkNamaBengkel').value.trim(),
        nomor_wa: $('bkWa').value,
        alamat: $('bkAlamat').value.trim(),
      },
    });
    showToast('Mitra bengkel baru berhasil ditambahkan.');
    $('bengkelForm').reset();
    loadAdminPanel();
  } catch (err) {
    showToast(err.message, true);
  }
});

$('btnCancelBengkel').addEventListener('click', () => {
  $('bengkelForm').reset();
});

/* Logo: pengguna masuk diarahkan ke dashboardnya, tamu ke katalog */
$('brandHome').addEventListener('click', (e) => {
  e.preventDefault();
  const role = currentRole();
  switchView(role === 'admin' ? 'admin' : role === 'bengkel' ? 'bengkel' : 'catalog');
});

/* ============ INIT ============ */
/* Katalog publik langsung tampil tanpa login; form masuk/daftar hanya muncul saat diminta */
(async function init() {
  try {
    const data = await api('/api/auth/me');
    if (data.user) state.user = data.user;
  } catch {}
  showApp();
})();
