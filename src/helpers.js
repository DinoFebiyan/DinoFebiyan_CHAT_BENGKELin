const KATEGORI = ['Jasa Bengkel', 'Bahan Bakar', 'Kunci Serep', 'Suku Cadang & Oli'];
const KATEGORI_JASA = ['Jasa Bengkel', 'Kunci Serep'];
const BENGKEL_STATUS = ['pending', 'active', 'rejected', 'suspended'];

function isServiceKategori(kategori) {
  return KATEGORI_JASA.includes(kategori);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

function normalizeWa(raw) {
  let digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  if (!digits.startsWith('62')) digits = '62' + digits;
  return digits;
}

function waValid(digits) {
  return /^62\d{8,13}$/.test(digits);
}

module.exports = { KATEGORI, KATEGORI_JASA, BENGKEL_STATUS, isServiceKategori, requireAuth, requireRole, normalizeWa, waValid };
