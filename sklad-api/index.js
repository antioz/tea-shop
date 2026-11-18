// sklad-api — Yandex Cloud Function (Node.js 18), HTTP-триггер. Маршрут в ?a=.
// Живой канал «МойСклад → сайт чайного магазина»: товары, фото, цены (когда заведут), остатки (когда появятся).
// Токен МойСклада — только в env, в браузер не уходит. Список товаров кэшируется на 10 минут.
const SPEC = require('./specs');

const BASE = 'https://api.moysklad.ru/api/remap/1.2';
const CACHE_TTL_MS = 10 * 60 * 1000;

const BASE_MAP = {
  'Белый чай': 'white',
  'Шу пуэр': 'shu-puer',
  'Шэн пуэр': 'sheng-puer',
  'Красный чай': 'red',
};
// позиции, переопределяющие категорию (как в старом catalog.json)
// на сайте не публикуем (сейчас пусто — в складе только 4 категории)
const HIDDEN = new Set(['chenpi', 'mandarin-shu']);
const SITE_CATEGORIES = ['shu-puer', 'sheng-puer', 'white', 'red'];

let cache = { at: 0, products: null };

const json = (code, obj, extra = {}) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...cors(), ...extra },
  body: JSON.stringify(obj),
});

const SITE_ORIGINS = (process.env.SITE_ORIGINS || '').split(' ').map(s => s.trim()).filter(Boolean);
function cors(origin) {
  const o = origin && SITE_ORIGINS.includes(origin) ? origin : SITE_ORIGINS[0] || '';
  return o ? { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin' } : {};
}

async function ms(path, headers = {}, attempt = 0) {
  const url = path.startsWith('http') ? path : BASE + path;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`, 'Accept-Encoding': 'gzip', ...headers },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status >= 500 && attempt < 2) {
      await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
      return ms(path, headers, attempt + 1);
    }
    const e = new Error(`moysklad ${r.status}: ${t.slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

async function products() {
  if (cache.products && Date.now() - cache.at < CACHE_TTL_MS) return cache.products;
  const all = [];
  let offset = 0;
  for (;;) {
    const d = await ms(`/entity/product?limit=100&offset=${offset}&archived=false`);
    all.push(...(d.rows || []));
    if ((d.rows || []).length < 100) break;
    offset += 100;
  }
  cache = { at: Date.now(), products: all };
  return all;
}

function toItem(p) {
  const num = parseInt(String(p.code).replace(/\D/g, ''), 10); // TEA-007 → 7
  const cat = BASE_MAP[p.pathName || ''];
  if (!cat || HIDDEN.has(cat)) return null;
  const spec = SPEC[String(num)] || {};
  const price = (v => (v > 0 ? Math.round(v) / 100 : null))(p.salePrices && p.salePrices[0] && Number(p.salePrices[0].value));
  return {
    num,
    name: p.name,
    price_rub: price,
    spec: spec.spec || null,
    unit: spec.unit || null,
    desc: p.description || null,
    qty: Number.isFinite(p.quantity) ? p.quantity : null,
    category: cat,
    img: (p.images && p.images.meta && p.images.meta.size > 0) ? `img&num=${num}` : null,
  };
}

function catalog() {
  const byCat = Object.fromEntries(SITE_CATEGORIES.map(s => [s, []]));
  for (const p of productsSync()) {
    const it = toItem(p);
    if (it) byCat[it.category].push(it);
  }
  for (const s of SITE_CATEGORIES) byCat[s].sort((a, b) => a.num - b.num);
  return { categories: byCat, now: new Date().toISOString(), source: 'moysklad' };
}

// products() асинхронна — оборачиваем, чтобы catalog() читался линейно
let productsSync = () => { throw new Error('products not loaded'); };

async function img(num) {
  const list = await products();
  const wanted = parseInt(String(num).replace(/\D/g, '') || '0', 10);
  const p = list.find(x => parseInt(String(x.code).replace(/\D/g, ''), 10) === wanted);
  if (!p) return null;
  const d = await ms(p.meta.href + '/images');
  const row = d.rows && d.rows[0];
  if (!row) return null;
  // downloadHref требует Authorization + Accept: json и отвечает 302 на подписанный S3.
  // <img> в браузере авторизацию не отправит — проксируем байты через себя.
  const r1 = await fetch(row.meta.downloadHref, {
    headers: { Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`, Accept: 'application/json;charset=utf-8' },
    redirect: 'manual',
  });
  const loc = r1.headers.get('location');
  if (!loc) return null;
  const r2 = await fetch(loc); // S3 — без наших заголовков
  if (!r2.ok) return null;
  return { body: Buffer.from(await r2.arrayBuffer()), type: r2.headers.get('content-type') || 'image/jpeg' };
}

module.exports.handler = async function (event) {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const origin = Object.keys(event.headers || {}).reduce((acc, k) => (k.toLowerCase() === 'origin' ? event.headers[k] : acc), undefined);
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { ...cors(origin), 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '3600' }, body: '' };
  }
  const q = event.queryStringParameters || {};
  try {
    switch (String(q.a || '')) {
      case 'catalog': {
        const list = await products();
        productsSync = () => list;
        return json(200, catalog(), cors(origin));
      }
      case 'product': {
        const list = await products();
        productsSync = () => list;
        const it = toItem(list.find(x => parseInt(String(x.code).replace(/\D/g, ''), 10) === parseInt(String(q.num || '').replace(/\D/g, '') || '0', 10)) || {});
        if (!it || !it.num) return json(404, { error: 'no_product' }, cors(origin));
        return json(200, { product: it, now: new Date().toISOString() }, cors(origin));
      }
      case 'img': {
        const im = await img(q.num);
        if (!im) return json(404, { error: 'no_image' }, cors(origin));
        return { statusCode: 200, headers: { 'Content-Type': im.type, 'Cache-Control': 'public, max-age=3600', ...cors(origin) }, body: im.body.toString('base64'), isBase64Encoded: true };
      }
      case 'health':
        return json(200, { ok: true, cached: !!cache.products, now: new Date().toISOString() }, cors(origin));
      default:
        return json(404, { error: 'unknown_route' }, cors(origin));
    }
  } catch (e) {
    console.error(e);
    return json(e.status === 401 || e.status === 403 ? 502 : 500, { error: 'sklad_api_error', detail: String(e.message || e).slice(0, 200) }, cors(origin));
  }
};
