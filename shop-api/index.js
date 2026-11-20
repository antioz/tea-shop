// shop-api — Yandex Cloud Function (Node.js 18), HTTP-триггер. Маршрут в ?a=.
// Заказы магазина в YDB (Document API), админ-роуты по ADMIN_TOKEN, прокси СДЭК, платёжный адаптер.
// Все секреты — только в env. Код и комментарии — на русском (правила проекта).
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const YDB = DynamoDBDocumentClient.from(new DynamoDBClient({
  endpoint: process.env.YDB_ENDPOINT,
  region: 'ru-central1',
  credentials: { accessKeyId: process.env.YDB_KEY_ID, secretAccessKey: process.env.YDB_KEY_SECRET },
}));

const SKLAD_URL = process.env.SKLAD_URL || 'https://functions.yandexcloud.net/d4etr4bluil1qvel94jf';
const MS_BASE = 'https://api.moysklad.ru/api/remap/1.2';
const ORDERS_TABLE = 'orders';

// ─── CORS (как в sklad-api: разделитель пробел; запятые тоже проглатываем) ───
const SITE_ORIGINS = (process.env.SITE_ORIGINS || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
function cors(origin) {
  const o = origin && SITE_ORIGINS.includes(origin) ? origin : SITE_ORIGINS[0] || '';
  return o ? { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin' } : {};
}

const json = (code, obj, origin, extra = {}) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin), ...extra },
  body: JSON.stringify(obj),
});

const body = (event) => {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
};

// ─── МойСклад (цены/товары для заказа и admin_price) ───
async function ms(path, opts = {}, attempt = 0) {
  const r = await fetch(path.startsWith('http') ? path : MS_BASE + path, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`, 'Accept-Encoding': 'gzip', 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status >= 500 && attempt < 2) {
      await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
      return ms(path, opts, attempt + 1);
    }
    const e = new Error(`moysklad ${r.status}: ${t.slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  return r.status === 204 ? {} : r.json();
}

async function catalog() {
  const r = await fetch(`${SKLAD_URL}?a=catalog`);
  if (!r.ok) throw new Error(`sklad-api ${r.status}`);
  return r.json();
}

// ─── СДЭК (env решает контур; ключи — только env) ───
const CDEK_BASE = process.env.CDEK_ENV === 'prod'
  ? 'https://api.cdek.ru/v2'
  : 'https://api.edu.cdek.ru/v2';
let cdekToken = { value: null, at: 0 };

async function cdekAuth() {
  if (cdekToken.value && Date.now() - cdekToken.at < 3300 * 1000) return cdekToken.value;
  if (!process.env.CDEK_CLIENT_ID || !process.env.CDEK_CLIENT_SECRET) {
    const e = new Error('cdek not configured');
    e.status = 503;
    throw e;
  }
  const r = await fetch(`${CDEK_BASE}/oauth/token?client_id=${process.env.CDEK_CLIENT_ID}&client_secret=${process.env.CDEK_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
  if (!r.ok) throw new Error(`cdek auth ${r.status}`);
  const d = await r.json();
  cdekToken = { value: d.access_token, at: Date.now() };
  return d.access_token;
}

async function cdek(path) {
  const token = await cdekAuth();
  const r = await fetch(CDEK_BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`cdek ${r.status}`);
  return r.json();
}

// ─── Админ-доступ: Authorization: Bearer <ADMIN_TOKEN> или ?token= ───
function isAdmin(event, q) {
  const h = Object.keys(event.headers || {}).reduce((acc, k) => (k.toLowerCase() === 'authorization' ? event.headers[k] : acc), '') || '';
  const bearer = h.replace(/^Bearer\s+/i, '');
  return (bearer && bearer === process.env.ADMIN_TOKEN) || (q.token && q.token === process.env.ADMIN_TOKEN);
}

// ─── Заказы ───
function newOrderId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `M-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function createOrder(data, origin) {
  const items = Array.isArray(data.items) ? data.items : [];
  const customer = data.customer || {};
  const delivery = data.delivery || {};
  if (!items.length) return json(400, { error: 'no_items' }, origin);
  if (!customer.name || !String(customer.phone || '').replace(/\D/g, '').match(/^7\d{10}$/)) {
    return json(400, { error: 'bad_customer', need: 'name + phone 7XXXXXXXXXX' }, origin);
  }
  if (customer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) {
    return json(400, { error: 'bad_email' }, origin);
  }
  if (!delivery.type || !['pvz', 'courier'].includes(delivery.type)) {
    return json(400, { error: 'bad_delivery', need: 'type: pvz|courier' }, origin);
  }

  // total считаем по живому каталогу — цены только из sklad-api, не из браузера
  const cat = await catalog();
  const priceByNum = new Map();
  for (const list of Object.values(cat.categories || {})) {
    for (const it of list) if (it.price_rub != null) priceByNum.set(it.num, it);
  }
  let total = 0;
  const orderItems = [];
  for (const raw of items) {
    const num = parseInt(String(raw.num).replace(/\D/g, ''), 10) || 0;
    const qty = Math.max(1, parseInt(raw.qty, 10) || 1);
    const p = priceByNum.get(num);
    if (!p) return json(400, { error: 'no_product', num }, origin);
    if (p.qty != null && p.qty < qty) return json(409, { error: 'no_stock', num, available: p.qty }, origin);
    total += p.price_rub * qty;
    orderItems.push({ num, name: p.name, price_rub: p.price_rub, qty });
  }

  const order = {
    order_id: newOrderId(),
    created_at: new Date().toISOString(),
    status: 'new',
    customer: { name: customer.name, phone: customer.phone, email: customer.email || null },
    items: orderItems,
    delivery: { type: delivery.type, pvz: delivery.pvz || null, address: delivery.address || null, city: delivery.city || null },
    payment: { provider: process.env.PAYMENT_PROVIDER || 'offline', status: 'pending', instruction: 'Оплата после подтверждения' },
    total,
  };
  await YDB.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
  return json(200, { order_id: order.order_id, total, status: order.status }, origin);
}

async function getOrder(q, origin) {
  const num = String(q.num || '').trim();
  // защита ПД: заказ отдаём только по паре «номер + телефон», иначе перебор номеров = чужие ПД
  const phone = String(q.phone || '').replace(/\D/g, '');
  if (!num || !phone.match(/^7\d{10}$/)) return json(400, { error: 'need num + phone' }, origin);
  const r = await YDB.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { order_id: num } }));
  if (!r.Item) return json(404, { error: 'not_found' }, origin);
  if (String((r.Item.customer || {}).phone || '').replace(/\D/g, '') !== phone) {
    return json(404, { error: 'not_found' }, origin);
  }
  return json(200, { order: r.Item }, origin);
}

async function adminOrders(q, origin) {
  const r = await YDB.send(new ScanCommand({ TableName: ORDERS_TABLE }));
  let rows = r.Items || [];
  if (q.status) rows = rows.filter(o => o.status === q.status);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return json(200, { orders: rows, count: rows.length }, origin);
}

async function adminMetrics(q, origin) {
  const r = await YDB.send(new ScanCommand({ TableName: ORDERS_TABLE }));
  const rows = r.Items || [];
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const inDay = rows.filter(o => now - Date.parse(o.created_at) < day);
  const inWeek = rows.filter(o => now - Date.parse(o.created_at) < 7 * day);
  const sum = (l) => l.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  return json(200, {
    today_count: inDay.length,
    week_count: inWeek.length,
    revenue_today: Math.round(sum(inDay) * 100) / 100,
    revenue_week: Math.round(sum(inWeek) * 100) / 100,
    avg_check: rows.length ? Math.round((sum(rows) / rows.length) * 100) / 100 : 0,
    total_count: rows.length,
  }, origin);
}

async function adminOrderStatus(data, origin) {
  const { order_id, status } = data;
  if (!order_id || !status) return json(400, { error: 'need order_id, status' }, origin);
  await YDB.send(new UpdateCommand({
    TableName: ORDERS_TABLE,
    Key: { order_id },
    UpdateExpression: 'SET #s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': String(status) },
  }));
  return json(200, { ok: true, order_id, status }, origin);
}

// admin_price: запись цены продажи в МойСклад (копейки)
async function adminPrice(data, origin) {
  const num = parseInt(String(data.num).replace(/\D/g, ''), 10) || 0;
  const priceRub = Number(data.price_rub);
  if (!num || !Number.isFinite(priceRub) || priceRub <= 0) return json(400, { error: 'need num, price_rub>0' }, origin);
  const found = await ms(`/entity/product?filter=code~TEA-${String(num).padStart(3, '0')}`);
  const p = (found.rows || [])[0];
  if (!p) return json(404, { error: 'no_product', num }, origin);
  const old = (p.salePrices && p.salePrices[0]) || {};
  const currencyId = old.currency && old.currency.meta.href.split('/').pop();
  await ms(p.meta.href, {
    method: 'PUT',
    body: JSON.stringify({
      salePrices: [{
        value: Math.round(priceRub * 100),
        currency: { meta: { href: `${MS_BASE}/entity/currency/${currencyId || '0bc5d53d-5ab0-11e6-8d09-0cc47ac69678'}`, type: 'currency', mediaType: 'application/json' } },
        priceType: old.priceType,
      }],
    }),
  });
  return json(200, { ok: true, num, price_rub: priceRub }, origin);
}

// ─── Хендлер ───
module.exports.handler = async function (event) {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const origin = Object.keys(event.headers || {}).reduce((acc, k) => (k.toLowerCase() === 'origin' ? event.headers[k] : acc), undefined);
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { ...cors(origin), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '3600' }, body: '' };
  }
  const q = event.queryStringParameters || {};
  try {
    switch (String(q.a || '')) {
      case 'order_create':
        if (method !== 'POST') return json(405, { error: 'post_only' }, origin);
        return await createOrder(body(event), origin);
      case 'order_get':
        return await getOrder(q, origin);
      case 'cdek_calc':
        return json(200, await cdek(`/calculator/tarifflist?from_location_id=44&to_location_id=${encodeURIComponent(q.city_to || '')}&packages[0][weight]=${encodeURIComponent(q.weight || 1000)}`), origin);
      case 'payment_webhook':
        // заглушка: провайдер появится позже, сейчас просто 200
        return json(200, { ok: true, received: true }, origin);
      case 'admin_orders':
        if (!isAdmin(event, q)) return json(403, { error: 'forbidden' }, origin);
        return await adminOrders(q, origin);
      case 'admin_metrics':
        if (!isAdmin(event, q)) return json(403, { error: 'forbidden' }, origin);
        return await adminMetrics(q, origin);
      case 'admin_order_status':
        if (!isAdmin(event, q) || method !== 'POST') return json(403, { error: 'forbidden' }, origin);
        return await adminOrderStatus(body(event), origin);
      case 'admin_price':
        if (!isAdmin(event, q) || method !== 'POST') return json(403, { error: 'forbidden' }, origin);
        return await adminPrice(body(event), origin);
      case 'health':
        return json(200, { ok: true, now: new Date().toISOString(), payment: process.env.PAYMENT_PROVIDER || 'offline', cdek_env: process.env.CDEK_ENV || 'test' }, origin);
      default:
        return json(404, { error: 'unknown_route' }, origin);
    }
  } catch (e) {
    console.error(e);
    return json(e.status && e.status >= 400 && e.status < 600 ? e.status : 500, { error: 'shop_api_error', detail: String(e.message || e).slice(0, 200) }, origin);
  }
};
