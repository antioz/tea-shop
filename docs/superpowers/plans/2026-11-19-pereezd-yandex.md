# Переезд чайного магазина на Yandex Cloud + админка + покупка + СДЭК + эквайринг

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести витрину и бэкенд магазина в каталог YC `tea-shop`, затем добавить заказы, админку, страницу покупки, доставку СДЭК и платёжный адаптер.

**Architecture:** Статический фронт — в Object Storage (веб-хостинг бакета). Бэк — две serverless-функции Node 18 в каталоге `tea-shop` (b1g7i9m9r6ibld09cess): `sklad-api` (существующий код, копия без изменений) и `shop-api` (новый: заказы в YDB, админ-роуты, прокси СДЭК, платёжный адаптер). Заказы хранятся в serverless YDB. Эквайринг — адаптер-интерфейс, сейчас заглушка («точка будет позже»), боевой провайдер включается одним env. СДЭК — сначала тестовый контур (api.edu.cdek.ru), боевые ключи — появятся позже.

**Tech Stack:** Yandex Cloud Functions (nodejs18) · Object Storage · YDB (serverless, Document API) · МойСклад API · СДЭК API v2 · vanilla JS фронт.

## Global Constraints

- Каталог YC: `b1g7i9m9r6ibld09cess` (tea-shop), облако `b1g474kvre57nm4js7h1`. Сервисный аккаунт `deploy` = `aje2o8hffl4sibdu44i1`, роль `editor`. Ключ — авторизованный key.json, НЕ в git.
- Текущий прод НЕ трогаем: функция `d4e6o6v2n3b9h8etfghd` и GitHub Pages остаются работать, пока новый контур не проверен и DNS не переключён.
- CORS: `SITE_ORIGINS` в env функций; на время параллельной работы туда входят и GitHub Pages, и доменное имя.
- Все секреты только в env функций (`.deploy.env` рядом с кодом, в .gitignore). Проверено: `sklad-api/.deploy.env` в игноре; для `shop-api` создать свой.
- Язык общения и комментариев в коде — русский (как в существующем sklad-api).
- После каждой задачи: коммит + пуш на main (кроме шагов, где меняется только облако).
- Домен магазина: `<ДОМЕН>` — автор ещё не назвал; все DNS/сертификат-шаги помечены [ждёт домен].
- Эквайринг: провайдер будет выбран позже. Сейчас — интерфейс `payments` с заглушкой `offline`; заказ создаётся со статусом `new`, оплата вне контура.

---

### Task 1: Ключ и профиль yc (инфраструктура доступа)

**Files:**
- Create: `~/.yc-keys/tea-shop-key.json` (копия из temp Telegram)
- Modify: `~/yandex-cloud/` профиль `tea-shop`

- [x] **Step 1: Переложить ключ из temp (temp чистится системой)**
```bash
mkdir -p ~/.yc-keys
cp "/var/folders/f0/kt74dwtn4pb__yv7_qfbytjh0000gn/T/ru.keepcoder.Telegram/authorized_key.json" ~/.yc-keys/tea-shop-key.json
chmod 600 ~/.yc-keys/tea-shop-key.json
```
- [x] **Step 2: Профиль tea-shop**
```bash
YC=~/yandex-cloud/bin/yc
$YC config profile create tea-shop
$YC config set service-account-key ~/.yc-keys/tea-shop-key.json
$YC config set cloud-id b1g474kvre57nm4js7h1
$YC config set folder-id b1g7i9m9r6ibld09cess
```
- [x] **Step 3: Проверка живого доступа**
```bash
$YC resource-manager folder get b1g7i9m9r6ibld09cess --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["name"])'
# Expected: tea-shop
```

### Task 2: Переезд sklad-api в новый каталог (копия, без изменений кода)

**Files:**
- Modify: `sklad-api/.deploy.env` (добавить SITE_ORIGINS нового домена позже; сейчас оставить)
- Create: функция `sklad-api` в каталоге tea-shop

**Interfaces:**
- Produces: новый `SKLAD_API_URL` (https://functions.yandexcloud.net/<new_id>) — константа для фронта и shop-api, записать в `sklad-api/DEPLOYED.md`.

- [x] **Step 1: Создать функцию и задеплоить тот же zip**
```bash
cd sklad-api
YC=~/yandex-cloud/bin/yc
$YC serverless function create --name sklad-api
./deploy.sh   # переиспользует .deploy.env; SA_ID уже там
```
- [x] **Step 2: Проверка в бою**
```bash
curl -s "$SKLAD_API_URL?a=health"   # Expected: {"ok":true,...}
curl -s "$SKLAD_API_URL?a=catalog" | head -c 200  # Expected: {"categories":{...}}
```
- [x] **Step 3: Записать URL, коммит DEPLOYED.md**

### Task 3: Бакет под фронт + заливка копии сайта

**Files:**
- Create: бакет `tea-shop-site-<суффикс>` (имя глобально уникально, см. шаг)

- [x] **Step 1: Создать бакет со статик-хостингом**
```bash
$YC storage bucket create --name tea-shop-site-$(date +%s | tail -c 7)
$YC storage bucket update --name <NAME> --public-read
$YC storage bucket website --name <NAME> --index index.html --error index.html
```
- [x] **Step 2: Залить копию фронта (как есть, ничего не меняя)**
```bash
# только то, что сейчас на GitHub Pages: корневые html + категории + product + images + catalog.json
yc-s3 или aws cli: sync index.html oferta.html privacy.html consent.html catalog.json product/ sheng-puer/ shu-puer/ white/ red/ images/ → s3://<NAME>/
```
- [x] **Step 3: Проверка в бою**
```bash
curl -s https://<NAME>.website.yandexcloud.net/ | grep -o "<title>[^<]*"  # Expected: title главной
```
- [ ] **Step 4 [ждёт домен]: Certificate Manager + DNS CNAME на <NAME>.website.yandexcloud.net**

### Task 4: YDB для заказов

- [x] **Step 1: Создать serverless YDB `tea-shop-orders` в каталоге** (создана 20.11: `etn59ff8v2f6cvl02e5u`)
- [x] **Step 2: Таблица `orders`: order_id (string, pk), created_at (utf8), status (utf8), customer JSON, items JSON, delivery JSON, payment JSON, total (double). Document API endpoint — в env shop-api.** (ACTIVE 20.11, endpoint в `shop-api/.deploy.env`)
- [x] **Step 3: Проверка: запись/чтение тестовой строки, удалить тестовую строку.** (пройдено 20.11: запись/чтение/удаление OK)

### Task 5: shop-api — новая функция заказов

**Files:**
- Create: `shop-api/index.js`, `shop-api/package.json`, `shop-api/deploy.sh`, `shop-api/.deploy.env` (в .gitignore)

**Interfaces:**
- Produces: HTTP `?a=`:
  - `POST order_create` {items[], customer{name,phone,email}, delivery{type,pvz?,address?}} → {order_id, total}
  - `GET order_get&num=<order_id>` → заказ
  - `GET admin_orders&token=&status=` → список (только ADMIN_TOKEN)
  - `POST admin_order_status` {order_id, status} → ok
  - `GET admin_metrics&token=` → {today_count, week_count, revenue_today, revenue_week, avg_check}
  - `POST admin_price` {num, price_rub} → запись цены в МойСклад (через sklad-api токен — тот же MOYSKLAD_TOKEN в env)
  - `GET cdek_calc&city_to=&weight=` → тарифы (прокси, test contour)
  - `POST cdek_create&token=` {order_id} → накладная (admin)
  - `POST payment_webhook` → заглушка, отвечает 200 (точка позже)
- Consumes: YDB Document API; env `MOYSKLAD_TOKEN`, `ADMIN_TOKEN`, `YDB_ENDPOINT`, `SITE_ORIGINS`, `CDEK_*` (test), `PAYMENT_PROVIDER=offline`.

- [x] **Step 1: Каркас функции по образцу sklad-api (handler/switch/cors/OPTIONS)** (готов, задеплоен 20.11)
- [x] **Step 2: order_create: валидация телефона/email, подсчёт total по живому каталогу (фетч sklad-api ?a=catalog), запись в YDB, статус `new`** (проверено: заказ M-20261120-YIRE создан, total 591, удалён после теста)
- [x] **Step 3: admin-роуты с проверкой `Authorization: Bearer $ADMIN_TOKEN`** (orders/metrics/order_status проверены; без токена — 403)
- [x] **Step 4: admin_price → PATCH /entity/product/<id> salePrices в МойСклад** (код готов; на боевом МС не дёргал — живая цена не менялась без команды)
- [x] **Step 5: Деплой, curl-проверка каждого роута в бою, коммит** (проверено IAM-вызовом 20.11; публичный вызов — тумблер в консоли, ждёт владельца облака)

### Task 6: Страница покупки (фронт)

**Files:**
- Modify: `product/index.html` (кнопка «Купить» + форма), Create: `order/index.html`

- [ ] **Step 1: Кнопка «Купить» на карточке → форма: ФИО, телефон, email, доставка (ПВЗ СДЭК через официальный виджет / курьер), кнопка «Оформить заказ»**
- [ ] **Step 2: POST в shop-api order_create → страница подтверждения с номером заказа**
- [ ] **Step 3: Оплата: блок «Оплата» со статусом «резерв: оплата после подтверждения» (заглушка PAYMENT_PROVIDER=offline)**
- [ ] **Step 4: Локальная проверка через http.server + прод-сайт после заливки**

### Task 7: СДЭК (тестовый контур)

- [ ] **Step 1: OAuth-токен от тестовых ключей (публичные, api.edu.cdek.ru)**
- [ ] **Step 2: cdek_calc: тарифы 136/137/234 для посылки, город получателя из виджета**
- [ ] **Step 3: Виджет выбора ПВЗ (cdek.ru/widget) на странице покупки**
- [ ] **Step 4: cdek_create в админке: кнопка из карточки заказа → тестовая накладная, печать квитанции**
- [ ] **Step 5: [ждёт ключи] переключение env на бой (CDEK_CLIENT_ID/SECRET prod) — без изменения кода**

### Task 8: Админка

**Files:**
- Create: `admin/index.html` (статика в отдельном префиксе бакета /admin/, не линкуется с витрины)

- [ ] **Step 1: Вход по ADMIN_TOKEN (поле + localStorage; реальная защита — на API)**
- [ ] **Step 2: Дашборд метрик (admin_metrics)**
- [ ] **Step 3: Список заказов, фильтр по статусу, смена статуса (admin_order_status)**
- [ ] **Step 4: Товары: таблица из sklad-api ?a=catalog, редактирование цены (admin_price)**
- [ ] **Step 5: Кнопка «Накладная СДЭК» в карточке заказа**
- [ ] **Step 6: Заливка в бакет /admin/, проверка с домена**

### Task 9: Платёжный адаптер (интерфейс, без провайдера)

**Files:**
- Modify: `shop-api/index.js` (модуль `payments/`)

- [ ] **Step 1: `payments/index.js`: `createPayment(order)` / `verifyWebhook(body)` — dispatch по `PAYMENT_PROVIDER` env**
- [ ] **Step 2: `payments/offline.js`: createPayment → {status:'pending', instruction:'Оплата после подтверждения'}**
- [ ] **Step 3: order_get отдаёт payment.status; фронт страницы заказа показывает инструкцию**
- [ ] **Step 4: [ждёт выбора точки] `payments/yookassa.js` или `payments/tbank.js` + webhook → статус `paid` + чек 54-ФЗ**

### Task 10: Переключение DNS [ждёт домен]

- [ ] DNS CNAME <ДОМЕН> → <NAME>.website.yandexcloud.net; SITE_ORIGINS обеих функций += https://<ДОМЕН>; SITE_ORIGINS в product/index.html (константа SKLAD_API остаётся); финальный E2E на домене; GitHub Pages оставить как резерв.

## Self-Review

- Spec coverage: переезд бэка (T2), переезд фронта (T3+T10), админка 4 пункта (T5 admin-роуты + T8 UI), страница покупки (T6), СДЭК (T7), эквайринг (T9). ✓
- Блокеры вне моего контроля: имя домена, боевые ключи СДЭК, выбор провайдера оплаты — все вынесены в помеченные шаги, они не останавливают T1–T6, T8.
