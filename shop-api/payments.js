// payments.js — платёжный адаптер «Точка Банк»: платёжные ссылки с фискализацией (54-ФЗ) + приём вебхуков.
// Документация: https://developers.tochka.com/docs/tochka-api (интернет-эквайринг)
// Секреты (TOCHKA_JWT) — только env. Система налогообложения и НДС — env (TOCHKA_TAX_SYSTEM, TOCHKA_VAT).
const crypto = require('crypto');

const UAPI = 'https://enter.tochka.com/uapi';
const JWK_URL = 'https://enter.tochka.com/doc/openapi/static/keys/public';

let jwkCache = { at: 0, key: null };
async function tochkaJwk() {
  if (jwkCache.key && Date.now() - jwkCache.at < 6 * 3600 * 1000) return jwkCache.key;
  const r = await fetch(JWK_URL);
  if (!r.ok) throw new Error('tochka jwk ' + r.status);
  jwkCache = { at: Date.now(), key: await r.json() };
  return jwkCache.key;
}

async function tochkaApi(method, path, body) {
  const r = await fetch(UAPI + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.TOCHKA_JWT}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify({ Data: body }) : undefined, // контур Точки ждёт обёртку {"Data": {...}}
  });
  const t = await r.text();
  let d = {};
  try { d = JSON.parse(t); } catch { /* ответ не JSON */ }
  if (!r.ok) throw new Error(`tochka ${r.status}: ${t.slice(0, 200)}`);
  return d;
}

// Создание платёжной ссылки с чеком. order — наш заказ, customer — {name, phone, email}.
async function createPaymentLink(order) {
  const c = order.customer || {};
  const payload = {
    customerCode: process.env.TOCHKA_CUSTOMER_CODE,
    merchantId: process.env.TOCHKA_MERCHANT_ID,
    amount: Number(order.total),
    purpose: `Оплата заказа ${order.order_id} · 野馬茶`.slice(0, 140),
    paymentMode: ['sbp', 'card'],
    paymentLinkId: order.order_id,
    redirectUrl: order.redirectUrl,
    failRedirectUrl: order.failRedirectUrl,
    Client: { name: c.name, email: c.email, phone: c.phone },
    Items: order.items.map((it) => ({
      name: it.name.slice(0, 256),
      amount: Number(it.price_rub),
      quantity: Number(it.qty),
      vatType: process.env.TOCHKA_VAT || 'vat20',
      paymentMethod: 'full_payment',
      paymentObject: 'goods',
    })),
  };
  if (process.env.TOCHKA_TAX_SYSTEM) payload.taxSystemCode = process.env.TOCHKA_TAX_SYSTEM;
  const d = await tochkaApi('POST', '/acquiring/v1.0/payments_with_receipt', payload);
  const op = (d.Data && d.Data.Operation && d.Data.Operation[0]) || d.Data || {};
  return { url: op.paymentLink, operationId: op.operationId, status: op.status };
}

// Проверка подписи вебхука (JWT RS256 публичным ключом Точки). Возвращает payload или null.
async function verifyWebhook(jwtString) {
  const parts = String(jwtString || '').split('.');
  if (parts.length !== 3) return null;
  const jwk = await tochkaJwk();
  const key = crypto.createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
  const data = `${parts[0]}.${parts[1]}`;
  let sig;
  try { sig = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'); } catch { return null; }
  let alg = 'sha256';
  try { alg = { RS256: 'sha256', RS384: 'sha384', RS512: 'sha512' }[JSON.parse(Buffer.from(parts[0], 'base64url').toString()).alg] || 'sha256'; } catch { /* по умолчанию sha256 */ }
  const ok = crypto.verify(alg, Buffer.from(data), key, sig);
  if (!ok) return null;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString()); } catch { return null; }
}

// Подписка на вебхук acquiringInternetPayment (один URL на client_id — перезаписывает).
async function ensureWebhook(clientId, url) {
  return tochkaApi('PUT', `/webhook/v1.0/${clientId}`, {
    url,
    webhooksList: ['ACQUIRING_INTERNET_PAYMENT'],
  });
}

module.exports = { createPaymentLink, verifyWebhook, ensureWebhook, tochkaApi };
