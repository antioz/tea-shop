# tea-shop: демо2 → основной сайт, редизайн главной, подстраницы сортов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать demo2 («Досье экспедиции») основным сайтом tea-shop: видео-фон в hero, новый порядок блоков (hero → фаундер → 6 сортов → принципы → подписка → footer), 6 статических подстраниц сортов с мини-каталогом, и скрипт экспорта каталога МойСклад → статический `catalog.json`.

**Architecture:** Статический сайт без сборки. Главная страница — существующий кастомный `x-dc`/JSX-рантайм (`support.js`, Babel-компиляция в браузере). 6 подстраниц — самостоятельные HTML-файлы того же типа, без общего шаблона (конвенция проекта). Каталог — не живой запрос к API МойСклада из браузера (небезопасно на статике), а разовый экспорт локальных данных (`moysklad-import/items.json`, уже извлечены из накладной) в `catalog.json`, который подстраницы читают через `fetch` во время выполнения.

**Tech Stack:** HTML + inline `x-dc`/JSX-подобная разметка, React/Babel standalone с unpkg (существующий рантайм, не меняется), Python 3 (`export_catalog.py`, тестируется через stdlib `unittest`).

## Global Constraints

- Проект статический, сборки нет — деплой прямой (GitHub Pages из main). [источник: CLAUDE.md]
- Язык интерфейса и коммуникации — русский. [источник: CLAUDE.md]
- После каждой завершённой задачи — коммит и пуш в `main`. [источник: CLAUDE.md]
- Никаких секретов (логин/пароль МойСклада) в клиентском коде/браузере. [источник: спека, раздел 5]
- Квиз «Подобрать чай» и боевая интеграция МойСклад↔сайт — вне рамок этого плана. [источник: спека]
- Репозиторий `antioz/tea-shop` публичный — реальные закупочные цены в `items.json`/`catalog.json` допустимы к публикации (подтверждено пользователем 2026-07-31).

---

### Task 1: Перенос demo2 в корень репозитория, удаление demo1 и старой страницы выбора

**Files:**
- Delete: `index.html` (текущий корневой, страница выбора), `demo1/` (вся папка)
- Move: `demo2/index.html` → `index.html`, `demo2/support.js` → `support.js`,
  `demo2/image-slot.js` → `image-slot.js`, `demo2/images/` → `images/`

**Interfaces:**
- Produces: корневой `index.html` со всеми относительными путями (`./support.js`,
  `./image-slot.js`, `./images/...`), не требующими правки — сохраняется структура
  «всё в одной папке», меняется только уровень (demo2/ → /).

- [ ] **Step 1: Проверить текущее состояние git**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop" && git status
```
Expected: рабочее дерево чистое относительно отслеживаемых файлов (могут быть
несвязанные untracked файлы — это нормально, их не трогаем).

- [ ] **Step 2: Удалить старую страницу выбора и demo1**

```bash
git rm index.html
git rm -r demo1
```
Expected: вывод `rm 'index.html'`, `rm 'demo1/index.html'`, `rm 'demo1/assets/...'` и т.д.

- [ ] **Step 3: Переместить содержимое demo2 в корень**

```bash
git mv demo2/index.html index.html
git mv demo2/support.js support.js
git mv demo2/image-slot.js image-slot.js
git mv demo2/images images
rmdir demo2
```
Expected: без ошибок; `rmdir demo2` завершается тихо (папка была пуста после mv).

- [ ] **Step 4: Проверить, что сайт открывается локально**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop" && python3 -m http.server 8765 &
sleep 1
curl -s http://localhost:8765/ | grep -o 'ЧАЙ ДИКОЙ<br/>ЛОШАДИ' 
kill %1
```
Expected: строка `ЧАЙ ДИКОЙ<br/>ЛОШАДИ` найдена в выводе curl (подтверждает, что
по корневому адресу отдаётся бывший demo2/index.html, а не старая страница выбора).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Демо2 становится основным сайтом: перенос в корень, удаление demo1 и страницы выбора

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 2: Видео-фон в hero вместо статичного фото

**Files:**
- Modify: `index.html:16-28` (блок `<style>`, убрать неиспользуемый keyframes `kenBurns`)
- Modify: `index.html:48-51` (hero-обёртка: `<img>` → `<video>`)
- Create: `images/hero.mp4` (плейсхолдер-видео, свободная лицензия)

**Interfaces:**
- Consumes: существующий `heroImgParallax` (см. `index.html:224`, `renderVals()`) —
  transform-выражение, не меняется, применяется к той же обёртке `<div>`.
- Produces: видео-элемент с `poster="./images/plantation.jpg"` — используется как
  визуальный fallback, ничего из последующих задач от него не зависит напрямую.

- [ ] **Step 1: Найти и скачать плейсхолдер-видео**

Найти через поиск бесплатный CC0/лицензионно-чистый видеоклип (туман в горах или
чайная плантация, ландшафтная ориентация, длительность 8–20 сек, вес до ~15 МБ,
например на pexels.com/videos или coverr.co — искать по запросу вроде
"misty mountains tea plantation free stock video"). Скачать его как:

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop"
curl -L -o images/hero.mp4 "<найденный прямой URL видеофайла>"
file images/hero.mp4
```
Expected: `file` показывает `ISO Media` / `MP4` (не HTML-страницу ошибки — если
вместо этого видно `HTML document`, значит ссылка была не на прямой файл, нужно
найти другую). Размер файла:

```bash
ls -la images/hero.mp4
```
Expected: > 100 КБ (не пустой/битый файл) и < 15 МБ (не раздувает репозиторий).
Если больше 15 МБ и установлен `ffmpeg` — сжать:
```bash
ffmpeg -y -i images/hero.mp4 -t 12 -vf "scale=1920:-2" -an -movflags +faststart images/hero_compressed.mp4
mv images/hero_compressed.mp4 images/hero.mp4
```

- [ ] **Step 2: Заменить `<img>` на `<video>` в hero**

В `index.html` найти блок (текущие строки 48–51):
```html
    <div style="position:absolute; inset:0; z-index:0; overflow:hidden; background:#0b0a09; transform:{{ heroImgParallax }};">
      <img src="./images/plantation.jpg" alt="Горы Юньнани в тумане" style="width:100%; height:100%; object-fit:cover; filter:brightness(.45) saturate(.75) contrast(1.08); animation:kenBurns 32s ease-in-out infinite alternate;"/>
      <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(11,10,9,.7) 0%, rgba(11,10,9,.35) 30%, rgba(11,10,9,.55) 65%, rgba(11,10,9,.95) 100%);"></div>
    </div>
```
Заменить на:
```html
    <div style="position:absolute; inset:0; z-index:0; overflow:hidden; background:#0b0a09; transform:{{ heroImgParallax }};">
      <video autoplay muted loop playsinline poster="./images/plantation.jpg" style="width:100%; height:100%; object-fit:cover; filter:brightness(.45) saturate(.75) contrast(1.08);">
        <source src="./images/hero.mp4" type="video/mp4">
      </video>
      <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(11,10,9,.7) 0%, rgba(11,10,9,.35) 30%, rgba(11,10,9,.55) 65%, rgba(11,10,9,.95) 100%);"></div>
    </div>
```

- [ ] **Step 3: Убрать неиспользуемый keyframes**

В блоке `<style>` (текущие строки 19) удалить строку:
```css
  @keyframes kenBurns { 0% { transform: scale(1.05); } 100% { transform: scale(1.15) translate(-1.5%,-1%); } }
```
(После шага 2 ничего больше на неё не ссылается — `grep -n kenBurns index.html`
должен вернуть пустой результат.)

- [ ] **Step 4: Проверить**

```bash
grep -n 'kenBurns' index.html
```
Expected: пусто (ничего не найдено).
```bash
grep -n '<video' index.html
```
Expected: одна строка с `<video autoplay muted loop playsinline poster=...`.

Ручная проверка: открыть `python3 -m http.server` → `http://localhost:8000/`,
убедиться, что видео проигрывается в фоне hero (не статичная картинка), звука нет,
зацикливается.

- [ ] **Step 5: Commit**

```bash
git add index.html images/hero.mp4
git commit -m "$(cat <<'EOF'
Hero: видео-фон вместо статичного фото с Кен-Бёрнсом

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 3: Блок фаундера

**Files:**
- Modify: `index.html` (вставка новой секции сразу после закрытия hero-секции,
  перед секцией каталога — после переноса в Task 1 это строки в районе 69-71
  исходной нумерации demo2/index.html; ориентироваться по маркеру
  `</section>` сразу после hero и перед `<section data-screen-label="02 — Каталог"`)
- Modify: `index.html` (добавить `.founder-grid` в `<style>` media-query для мобилки)
- Modify: `index.html` (добавить `founderRevealStyle` в `renderVals()`)

**Interfaces:**
- Consumes: `{{ accent }}`, `this.revealStyle(id, delay)` — уже существующий метод
  компонента (см. `index.html:208-213` до переноса), сигнатура не меняется.
- Produces: секция с `id="founder"`, на неё будет ссылаться кнопка "Подобрать чай"
  из hero, если понадобится (сейчас якорь ведёт с самой кнопки в этой же секции
  на `#varieties`, см. Task 4).

- [ ] **Step 1: Добавить секцию фаундера**

Вставить сразу после `</section>` hero-блока (перед `<section data-screen-label="02 — Каталог"...>`):
```html
  <section data-screen-label="02 — Фаундер" id="founder" data-reveal-id="founder" style="position:relative; padding:110px 40px; background:#131110; {{ founderRevealStyle }}">
    <div class="founder-grid" style="max-width:980px; margin:0 auto; display:grid; grid-template-columns:280px 1fr; gap:56px; align-items:center;">
      <div style="border-radius:4px; overflow:hidden; border:1px solid rgba(240,233,218,0.12);">
        <img src="./images/founder-sergey.png" alt="Сергей Ермаков, основатель 野馬茶" style="width:100%; height:100%; object-fit:cover; display:block; filter:grayscale(.15) contrast(1.05);"/>
      </div>
      <div>
        <div style="font-size:10.5px; letter-spacing:.18em; color:{{ accent }}; margin-bottom:18px;">ОСНОВАТЕЛЬ</div>
        <h2 style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:clamp(26px,3vw,36px); color:#f5efe1; margin:0 0 20px;">Привет, я Сергей Ермаков</h2>
        <p style="font-size:14.5px; line-height:1.85; color:#c9c0b3; margin:0 0 32px; max-width:440px;">Продаю то, что пью сам. А если нужна помощь в подборе чая — давай сделаем.</p>
        <a href="#varieties" style="background:{{ accent }}; color:#f5efe1; text-decoration:none; font-size:12px; letter-spacing:.14em; padding:16px 36px; transition:all .35s ease; display:inline-block;" style-hover="background:#a85862; transform:translateY(-2px);">ПОДОБРАТЬ ЧАЙ →</a>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Мобильная адаптация**

В `<style>` найти существующий media-query (было на строке 25-28 demo2/index.html):
```css
  @media (max-width:760px){
    .nav-links{ display:none !important; }
    .footer-grid{ grid-template-columns:1fr !important; gap:36px !important; }
  }
```
Добавить внутрь `.founder-grid`:
```css
  @media (max-width:760px){
    .nav-links{ display:none !important; }
    .footer-grid{ grid-template-columns:1fr !important; gap:36px !important; }
    .founder-grid{ grid-template-columns:1fr !important; gap:28px !important; }
  }
```

- [ ] **Step 3: Добавить `founderRevealStyle` в данные компонента**

В `renderVals()` (метод класса `Component`), в объекте, который возвращается,
рядом с `ritualRevealStyle: this.revealStyle('ritual', 0),` добавить:
```js
      founderRevealStyle: this.revealStyle('founder', 0),
```

- [ ] **Step 4: Проверить**

```bash
grep -n 'id="founder"' index.html
grep -n 'founderRevealStyle' index.html
```
Expected: обе строки найдены (секция + и объявление стиля, и использование в разметке — 2 вхождения `founderRevealStyle`, и 1 — `founder-grid` дважды: класс + media query).

Ручная проверка в браузере: между hero и блоком сортов виден блок с фото Сергея,
цитатой и кнопкой «Подобрать чай»; на мобильной ширине (devtools, 375px) фото и
текст стоят друг под другом, не сжаты в две узкие колонки.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Главная: блок фаундера (фото, цитата, кнопка «Подобрать чай»)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 4: Блок 6 сортов вместо старого каталога-плейсхолдера

**Files:**
- Modify: `index.html` (заменить секцию `id="catalog"` на секцию `id="varieties"`)
- Modify: `index.html` (в `renderVals()`/теле класса: удалить `teas`/`teasStyled`, добавить `varieties`/`varietiesStyled`)
- Modify: `index.html` (nav: 2 ссылки, указывающие на `#catalog`)

**Interfaces:**
- Consumes: `this.revealStyle('varieties', delay)`, `{{ accent }}` — как в Task 3.
- Produces: `id="varieties"` — целевой якорь для кнопки «Подобрать чай» (Task 3)
  и для nav-ссылок; 6 карточек-ссылок на `./shu-puer/`, `./sheng-puer/`, `./white/`,
  `./red/`, `./mandarin-shu/`, `./chenpi/` — эти пути должны существовать после Task 7.

- [ ] **Step 1: Удалить старую секцию каталога и данные `teas`**

Удалить целиком секцию (было `index.html:71-99` в demo2):
```html
  <section data-screen-label="02 — Каталог" id="catalog" data-reveal-id="catalog" style="position:relative; padding:60px 40px 140px; background:#131110;">
    ...
  </section>
```
Удалить в теле класса массив `teas` (было `index.html:161-166`):
```js
  teas = [
    { num: '01', slug: 'tea-gongting-puer', ... },
    ...
  ];
```
Удалить в `renderVals()` строку:
```js
    const teasStyled = this.teas.map((t, i) => ({ ...t, style: this.revealStyle('catalog', 0.04 * i) }));
```
и в возвращаемом объекте — `teas: teasStyled,`.

- [ ] **Step 2: Добавить секцию 6 сортов на её место**

На место удалённой секции (между founder и ritual):
```html
  <section data-screen-label="03 — Сорта" id="varieties" data-reveal-id="varieties" style="position:relative; padding:60px 40px 140px; background:#131110;">
    <div style="max-width:1180px; margin:0 auto;">
      <div style="margin-bottom:30px; padding-bottom:30px; border-bottom:1px solid rgba(240,233,218,0.1);">
        <div style="font-size:10.5px; letter-spacing:.18em; color:{{ accent }}; margin-bottom:18px;">01 — СОРТА</div>
        <h2 style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:clamp(30px,3.6vw,46px); color:#f5efe1; margin:0;">Шесть сортов</h2>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:20px;">
        <sc-for list="{{ varieties }}" as="v" hint-placeholder-count="6">
          <a href="{{ v.href }}" style="display:block; text-decoration:none; background:linear-gradient(160deg, {{ v.colorA }} 0%, {{ v.colorB }} 100%); border-top:3px solid {{ accent }}; padding:48px 26px; min-height:220px; position:relative; overflow:hidden; {{ v.style }}">
            <div style="font-size:10px; letter-spacing:.14em; color:rgba(240,233,218,.6); margin-bottom:14px;">{{ v.cn }}</div>
            <div style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:24px; color:#f5efe1;">{{ v.ru }}</div>
          </a>
        </sc-for>
      </div>
    </div>
  </section>
```

- [ ] **Step 3: Добавить данные `varieties` в тело класса**

Рядом с (существующим) `steps = [...]` добавить:
```js
  varieties = [
    { slug: 'shu-puer', ru: 'Шу пуэр', cn: '熟普洱', href: './shu-puer/', colorA: '#2a1c18', colorB: '#1c1310' },
    { slug: 'sheng-puer', ru: 'Шэн пуэр', cn: '生普洱', href: './sheng-puer/', colorA: '#23241a', colorB: '#171810' },
    { slug: 'white', ru: 'Белый чай', cn: '白茶', href: './white/', colorA: '#2a2620', colorB: '#1d1a16' },
    { slug: 'red', ru: 'Красный чай', cn: '红茶', href: './red/', colorA: '#2c1a1a', colorB: '#1c1112' },
    { slug: 'mandarin-shu', ru: 'Шу в мандаринах', cn: '小青柑', href: './mandarin-shu/', colorA: '#24261c', colorB: '#181910' },
    { slug: 'chenpi', ru: 'Мандариновая кожура', cn: '陈皮', href: './chenpi/', colorA: '#291f16', colorB: '#1b150e' },
  ];
```

- [ ] **Step 4: Добавить `varietiesStyled` в `renderVals()`**

Рядом с местом, где раньше был `teasStyled`, добавить:
```js
    const varietiesStyled = this.varieties.map((v, i) => ({ ...v, style: this.revealStyle('varieties', 0.04 * i) }));
```
И в возвращаемом объекте:
```js
      varieties: varietiesStyled,
```

- [ ] **Step 5: Обновить nav-ссылки**

Заменить (было `index.html:39`):
```html
      <a href="#catalog" style="color:#c7bfaf; text-decoration:none; font-size:11.5px; letter-spacing:.1em; border-bottom:1px solid transparent; padding-bottom:3px;" style-hover="color:#f0e9da; border-color:{{ accent }};">01 · КОЛЛЕКЦИЯ</a>
```
на:
```html
      <a href="#varieties" style="color:#c7bfaf; text-decoration:none; font-size:11.5px; letter-spacing:.1em; border-bottom:1px solid transparent; padding-bottom:3px;" style-hover="color:#f0e9da; border-color:{{ accent }};">01 · СОРТА</a>
```
Заменить (было `index.html:43`):
```html
    <a href="#catalog" style="border:1px solid rgba(240,233,218,0.3); color:#f0e9da; text-decoration:none; font-size:11px; letter-spacing:.14em; padding:11px 24px; transition:all .35s ease;" style-hover="border-color:{{ accent }}; background:{{ accent }};">КАТАЛОГ →</a>
```
на:
```html
    <a href="#varieties" style="border:1px solid rgba(240,233,218,0.3); color:#f0e9da; text-decoration:none; font-size:11px; letter-spacing:.14em; padding:11px 24px; transition:all .35s ease;" style-hover="border-color:{{ accent }}; background:{{ accent }};">СОРТА →</a>
```

- [ ] **Step 6: Проверить**

```bash
grep -n 'href="#catalog"' index.html
```
Expected: пусто (все ссылки на `#catalog` заменены).
```bash
grep -c "slug: '" index.html
```
Expected: `6` (все 6 сортов присутствуют).

Ручная проверка: блок «Шесть сортов» между фаундером и «Принципами» показывает
6 карточек разных оттенков с китайским+русским названием; клик по каждой пока
может вести на несуществующий путь (404) — это ожидаемо до Task 7, где эти
6 подстраниц будут созданы.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Главная: блок 6 сортов вместо каталога-плейсхолдера с шуточными названиями

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 5: Блок подписки на каналы + обновление футера

**Files:**
- Modify: `index.html` (вставить секцию `id="subscribe"` между `ritual` и `footer`)
- Modify: `index.html` (футер: колонка «Навигация» — заменить/добавить ссылки)

**Interfaces:**
- Consumes: `{{ accent }}`, существующий контакт `https://t.me/wildhorsetea`
  (уже используется в футере, см. `index.html:145` до переноса).
- Produces: `id="subscribe"` — целевой якорь для футерной ссылки «Подписка».

- [ ] **Step 1: Вставить секцию подписки**

Сразу после закрывающего `</section>` блока «Принципы» (`ritual`) и перед
`<footer ...>`:
```html
  <section data-screen-label="04 — Подписка" id="subscribe" data-reveal-id="subscribe" style="position:relative; padding:90px 40px; text-align:center; border-top:1px solid rgba(240,233,218,0.1);">
    <div style="max-width:640px; margin:0 auto;">
      <div style="font-size:10.5px; letter-spacing:.18em; color:{{ accent }}; margin-bottom:20px;">ПОДПИСКА</div>
      <h2 style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:clamp(24px,2.8vw,34px); color:#f5efe1; margin:0 0 26px;">Разборы чая и партий — в канале</h2>
      <a href="https://t.me/wildhorsetea" style="background:{{ accent }}; color:#f5efe1; text-decoration:none; font-size:12px; letter-spacing:.14em; padding:16px 36px; transition:all .35s ease; display:inline-block;" style-hover="background:#a85862; transform:translateY(-2px);">ПОДПИСАТЬСЯ В TELEGRAM →</a>
    </div>
  </section>
```

- [ ] **Step 2: Обновить колонку «Навигация» в футере**

Заменить (было `index.html:136-139`):
```html
        <div style="display:flex; flex-direction:column; gap:13px;">
          <a href="#catalog" style="color:#c7bfaf; text-decoration:none; font-size:12.5px;" style-hover="color:{{ accent }};">Коллекция</a>
          <a href="#ritual" style="color:#c7bfaf; text-decoration:none; font-size:12.5px;" style-hover="color:{{ accent }};">Принципы</a>
        </div>
```
на:
```html
        <div style="display:flex; flex-direction:column; gap:13px;">
          <a href="#varieties" style="color:#c7bfaf; text-decoration:none; font-size:12.5px;" style-hover="color:{{ accent }};">Сорта</a>
          <a href="#ritual" style="color:#c7bfaf; text-decoration:none; font-size:12.5px;" style-hover="color:{{ accent }};">Принципы</a>
          <a href="#subscribe" style="color:#c7bfaf; text-decoration:none; font-size:12.5px;" style-hover="color:{{ accent }};">Подписка</a>
        </div>
```

- [ ] **Step 3: Проверить**

```bash
grep -n 'id="subscribe"' index.html
grep -n '>Сорта<\|>Подписка<' index.html
```
Expected: обе команды находят соответствующие строки.

Ручная проверка: порядок секций в браузере сверху вниз — Hero, Фаундер, Сорта,
Принципы, Подписка, Footer; клик по «Подписка» в футере скроллит к блоку подписки.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Главная: блок подписки на Telegram-канал, обновлена навигация футера

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 6: Скрипт экспорта каталога МойСклад → catalog.json

**Files:**
- Create: `moysklad-import/export_catalog.py`
- Create: `moysklad-import/test_export_catalog.py`
- Create (generated by running the script): `catalog.json` (корень репозитория)
- Create (generated by running the script): `catalog-photos/*.jpg` (корень репозитория)

**Interfaces:**
- Consumes: `moysklad-import/items.json` — список из 54 объектов с полями
  `num` (int), `name` (str), `spec` (str|null), `unit` (str), `qty` (number),
  `price_rub` (number), `category` (одно из: `"Белый чай"`, `"Шу пуэр"`,
  `"Шэн пуэр"`, `"Красный чай"`). Также `moysklad-import/photos/row{N}.*`
  (N = `num + 1`) — фото товара, если есть (только для позиций 1–27).
- Produces: `catalog.json` — объект вида
  `{"shu-puer": [...], "sheng-puer": [...], "white": [...], "red": [...], "mandarin-shu": [...], "chenpi": [...]}`,
  каждый элемент массива — `{"num": int, "name": str, "price_rub": number, "spec": str|null, "unit": str, "img": str|null}`,
  где `img`, если не `null`, — путь вида `"catalog-photos/{num}.jpg"` (относительно
  корня сайта; подстраницы, лежащие на уровень ниже, должны подставлять префикс `../`).

- [ ] **Step 1: Написать тесты классификации (падающие)**

Создать `moysklad-import/test_export_catalog.py`:
```python
import unittest
from export_catalog import classify_site_category


class TestClassifySiteCategory(unittest.TestCase):
    def test_plain_white_tea(self):
        self.assertEqual(classify_site_category({'num': 1, 'category': 'Белый чай'}), 'white')

    def test_plain_shu_puer(self):
        self.assertEqual(classify_site_category({'num': 2, 'category': 'Шу пуэр'}), 'shu-puer')

    def test_plain_sheng_puer(self):
        self.assertEqual(classify_site_category({'num': 7, 'category': 'Шэн пуэр'}), 'sheng-puer')

    def test_plain_red_tea(self):
        self.assertEqual(classify_site_category({'num': 48, 'category': 'Красный чай'}), 'red')

    def test_chenpi_override_item_3(self):
        self.assertEqual(classify_site_category({'num': 3, 'category': 'Шу пуэр'}), 'chenpi')

    def test_chenpi_override_item_10(self):
        self.assertEqual(classify_site_category({'num': 10, 'category': 'Белый чай'}), 'chenpi')

    def test_mandarin_shu_overrides(self):
        self.assertEqual(classify_site_category({'num': 26, 'category': 'Шу пуэр'}), 'mandarin-shu')
        self.assertEqual(classify_site_category({'num': 27, 'category': 'Шу пуэр'}), 'mandarin-shu')

    def test_brick_stays_shu_puer(self):
        self.assertEqual(classify_site_category({'num': 9, 'category': 'Шу пуэр'}), 'shu-puer')


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Запустить тесты, убедиться что падают (модуля ещё нет)**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop/moysklad-import" && python3 -m unittest test_export_catalog -v
```
Expected: `ModuleNotFoundError: No module named 'export_catalog'` (или ImportError) — тесты не могут запуститься, это ожидаемо.

- [ ] **Step 3: Реализовать `export_catalog.py`**

Создать `moysklad-import/export_catalog.py`:
```python
import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent
ITEMS_FILE = HERE / "items.json"
PHOTOS_DIR = HERE / "photos"
SITE_ROOT = HERE.parent
CATALOG_FILE = SITE_ROOT / "catalog.json"
CATALOG_PHOTOS_DIR = SITE_ROOT / "catalog-photos"

BASE_MAP = {
    "Белый чай": "white",
    "Шу пуэр": "shu-puer",
    "Шэн пуэр": "sheng-puer",
    "Красный чай": "red",
}

OVERRIDES = {
    3: "chenpi",
    9: "shu-puer",
    10: "chenpi",
    26: "mandarin-shu",
    27: "mandarin-shu",
}

SITE_CATEGORIES = ["shu-puer", "sheng-puer", "white", "red", "mandarin-shu", "chenpi"]


def classify_site_category(item):
    if item["num"] in OVERRIDES:
        return OVERRIDES[item["num"]]
    return BASE_MAP[item["category"]]


def find_photo(num):
    matches = sorted(PHOTOS_DIR.glob(f"row{num + 1}.*"))
    return matches[0] if matches else None


def build_catalog():
    items = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    catalog = {slug: [] for slug in SITE_CATEGORIES}
    CATALOG_PHOTOS_DIR.mkdir(exist_ok=True)

    for item in items:
        site_category = classify_site_category(item)
        photo = find_photo(item["num"])
        img = None
        if photo:
            dest = CATALOG_PHOTOS_DIR / f"{item['num']}{photo.suffix}"
            shutil.copyfile(photo, dest)
            img = f"catalog-photos/{item['num']}{photo.suffix}"

        catalog[site_category].append({
            "num": item["num"],
            "name": item["name"],
            "price_rub": item["price_rub"],
            "spec": item.get("spec"),
            "unit": item["unit"],
            "img": img,
        })

    return catalog


def main():
    catalog = build_catalog()
    CATALOG_FILE.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    total = sum(len(v) for v in catalog.values())
    print(f"catalog.json: {total} позиций по {len(SITE_CATEGORIES)} категориям")
    for slug in SITE_CATEGORIES:
        print(f"  {slug}: {len(catalog[slug])}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop/moysklad-import" && python3 -m unittest test_export_catalog -v
```
Expected: 8 тестов, все `ok`, итог `OK`.

- [ ] **Step 5: Запустить скрипт и проверить результат**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop/moysklad-import" && python3 export_catalog.py
```
Expected: печать вида `catalog.json: 54 позиций по 6 категориям` и разбивку по
6 строкам, сумма которых равна 54.

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop" && python3 -c "
import json
d = json.load(open('catalog.json', encoding='utf-8'))
assert sum(len(v) for v in d.values()) == 54, 'сумма категорий должна быть 54'
assert set(d.keys()) == {'shu-puer','sheng-puer','white','red','mandarin-shu','chenpi'}
print('OK, категории:', {k: len(v) for k, v in d.items()})
"
```
Expected: `OK, категории: {...}` без `AssertionError`.

- [ ] **Step 6: Commit**

```bash
git add moysklad-import/export_catalog.py moysklad-import/test_export_catalog.py catalog.json catalog-photos/
git commit -m "$(cat <<'EOF'
Скрипт экспорта каталога МойСклад → статический catalog.json для демо-сайта

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 7: Шесть подстраниц сортов

**Files:**
- Create: `shu-puer/index.html`, `sheng-puer/index.html`, `white/index.html`,
  `red/index.html`, `mandarin-shu/index.html`, `chenpi/index.html`

**Interfaces:**
- Consumes: `../support.js`, `../image-slot.js`, `../images/plantation.jpg`
  (плейсхолдер шапки — реальных фото по сортам пока нет), `../catalog.json`
  (Task 6) — читается через `fetch` в `componentDidMount`, фильтруется по
  ключу категории (`shu-puer`, `sheng-puer`, `white`, `red`, `mandarin-shu`, `chenpi`).
- Produces: 6 маршрутов, на которые ссылаются карточки из Task 4
  (`./shu-puer/`, `./sheng-puer/`, `./white/`, `./red/`, `./mandarin-shu/`, `./chenpi/`).

Каждая страница — самостоятельный `x-dc`-документ по образцу главной страницы
(тот же `support.js`, тот же паттерн `{{ }}`/`sc-for`). Ниже — полный текст для
`shu-puer/index.html`; остальные 5 — тот же файл с точечными заменами по таблице
в Step 2.

- [ ] **Step 1: Создать `shu-puer/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="../support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Noto+Serif+SC:wght@400;600&family=PT+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<script src="../image-slot.js"></script>
<style>
  body { margin:0; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  * { box-sizing:border-box; }
  @media (max-width:760px){
    .nav-links{ display:none !important; }
  }
</style>
</helmet>
<div id="wht-root" style="position:relative; background:#0b0a09; color:#f0e9da; font-family:'PT Sans',sans-serif; font-weight:400; overflow-x:hidden;">

  <nav style="position:fixed; top:0; left:0; right:0; z-index:50; display:flex; align-items:center; justify-content:space-between; padding:16px 40px; background:rgba(11,10,9,0.88); backdrop-filter:blur(14px); border-bottom:1px solid rgba(240,233,218,0.08);">
    <div style="display:flex; align-items:center; gap:14px;">
      <a href="../"><img src="../images/logo-cream.png" alt="野馬茶 · Чай дикой лошади" style="height:40px; width:auto; display:block; flex-shrink:0;"></a>
      <span style="font-size:8.5px; letter-spacing:.24em; color:#7a7166;">WILD HORSE TEA CO.</span>
    </div>
    <div class="nav-links" style="display:flex; align-items:center; gap:36px;">
      <a href="../#varieties" style="color:#c7bfaf; text-decoration:none; font-size:11.5px; letter-spacing:.1em;">СОРТА</a>
      <a href="../#ritual" style="color:#c7bfaf; text-decoration:none; font-size:11.5px; letter-spacing:.1em;">ПРИНЦИПЫ</a>
      <a href="../#footer" style="color:#c7bfaf; text-decoration:none; font-size:11.5px; letter-spacing:.1em;">КОНТАКТЫ</a>
    </div>
    <a href="#catalog" style="border:1px solid rgba(240,233,218,0.3); color:#f0e9da; text-decoration:none; font-size:11px; letter-spacing:.14em; padding:11px 24px;">КАТАЛОГ →</a>
  </nav>

  <section style="position:relative; min-height:56vh; display:flex; align-items:flex-end; padding:120px 40px 60px; overflow:hidden;">
    <div style="position:absolute; inset:0; z-index:0; overflow:hidden; background:#0b0a09;">
      <img src="../images/plantation.jpg" alt="Шу пуэр" style="width:100%; height:100%; object-fit:cover; filter:brightness(.4) saturate(.75) contrast(1.08);"/>
      <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(11,10,9,.5) 0%, rgba(11,10,9,.9) 100%);"></div>
    </div>
    <div style="position:relative; z-index:1; max-width:920px;">
      <div style="font-size:11px; letter-spacing:.5em; color:{{ accent }}; margin-bottom:20px;">熟普洱</div>
      <h1 style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:clamp(38px,6vw,72px); line-height:1.05; margin:0; color:#f5efe1;">Шу пуэр</h1>
    </div>
  </section>

  <section style="max-width:760px; margin:0 auto; padding:70px 40px;">
    <div style="font-size:10.5px; letter-spacing:.18em; color:{{ accent }}; margin-bottom:18px;">О СОРТЕ</div>
    <p style="font-size:15px; line-height:1.9; color:#c9c0b3; margin:0 0 50px;">Текст об этом сорте пришлёт владелец — здесь временная заглушка.</p>
    <div style="font-size:10.5px; letter-spacing:.18em; color:{{ accent }}; margin-bottom:18px;">КАК ЗАВАРИВАТЬ</div>
    <p style="font-size:15px; line-height:1.9; color:#c9c0b3; margin:0;">Инструкция по завариванию пришлёт владелец — здесь временная заглушка.</p>
  </section>

  <section id="catalog" style="position:relative; padding:20px 40px 140px; background:#131110;">
    <div style="max-width:1180px; margin:0 auto;">
      <div style="margin-bottom:30px; padding-bottom:30px; border-bottom:1px solid rgba(240,233,218,0.1);">
        <h2 style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:clamp(26px,3.2vw,36px); color:#f5efe1; margin:0;">Каталог</h2>
      </div>
      <div style="display:{{ items.length ? 'grid' : 'block' }}; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:20px;">
        <sc-for list="{{ items }}" as="tea" hint-placeholder-count="4">
          <div style="background:#ece4d1; border:1px solid rgba(28,23,18,0.08); border-top:3px solid {{ accent }}; overflow:hidden;">
            <div style="position:relative; aspect-ratio:1/1; overflow:hidden; background:#d8cdb4;">
              <img src="{{ tea.img }}" alt="{{ tea.name }}" style="width:100%; height:100%; object-fit:cover; display:{{ tea.img ? 'block' : 'none' }};"/>
            </div>
            <div style="padding:22px 24px 26px;">
              <div style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:18px; color:#2a2015; margin-bottom:10px;">{{ tea.name }}</div>
              <div style="font-size:12px; color:#6b5c46; margin-bottom:16px;">{{ tea.spec }}</div>
              <div style="display:flex; justify-content:space-between; align-items:baseline; padding-top:14px; border-top:1px solid {{ accent }}22;">
                <span style="font-size:11px; letter-spacing:.1em; color:#8a7a5f;">{{ tea.unit }}</span>
                <span style="font-family:'Cormorant Garamond',serif; font-weight:600; font-size:17px; color:{{ accent }};">{{ tea.price_rub }} ₽</span>
              </div>
            </div>
          </div>
        </sc-for>
      </div>
      <p style="{{ error ? '' : 'display:none;' }} color:#c9c0b3; font-size:14px; text-align:center; padding:40px 0;">Каталог временно недоступен.</p>
    </div>
  </section>

  <footer style="position:relative; padding:60px 40px 34px; border-top:1px solid rgba(240,233,218,0.1); text-align:center;">
    <a href="../" style="color:#c7bfaf; text-decoration:none; font-size:12.5px;">← Вернуться на главную</a>
  </footer>
</div>

</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;accent&quot;: {&quot;editor&quot;:&quot;color&quot;,&quot;default&quot;:&quot;#8a3b42&quot;,&quot;tsType&quot;:&quot;string&quot;}}">
class Component extends DCLogic {
  state = { items: [], error: false };

  categorySlug = 'shu-puer';

  componentDidMount() {
    fetch('../catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error('bad status');
        return r.json();
      })
      .then((data) => {
        const items = (data[this.categorySlug] || []).map((it) => ({
          ...it,
          img: it.img ? `../${it.img}` : null,
        }));
        this.setState({ items });
      })
      .catch(() => this.setState({ error: true }));
  }

  renderVals() {
    const accent = this.props.accent || '#8a3b42';
    return {
      accent,
      items: this.state.items,
      error: this.state.error,
    };
  }
}

</script>
</body>
</html>
```

- [ ] **Step 2: Создать остальные 5 страниц копированием с точечными заменами**

Для каждой из 5 оставшихся страниц: скопировать `shu-puer/index.html` в целевой
путь и заменить ровно 4 значения — заголовок `<h1>`, китайскую метку над ним,
`alt` в hero-картинке и `categorySlug` в скрипте. Таблица замен:

| Файл | `<h1>` | Метка (китайский) | `alt` картинки | `categorySlug` |
|---|---|---|---|---|
| `sheng-puer/index.html` | `Шэн пуэр` | `生普洱` | `Шэн пуэр` | `'sheng-puer'` |
| `white/index.html` | `Белый чай` | `白茶` | `Белый чай` | `'white'` |
| `red/index.html` | `Красный чай` | `红茶` | `Красный чай` | `'red'` |
| `mandarin-shu/index.html` | `Шу в мандаринах` | `小青柑` | `Шу в мандаринах` | `'mandarin-shu'` |
| `chenpi/index.html` | `Мандариновая кожура` | `陈皮` | `Мандариновая кожура` | `'chenpi'` |

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop"
for pair in "sheng-puer:Шэн пуэр:生普洱:sheng-puer" "white:Белый чай:白茶:white" "red:Красный чай:红茶:red" "mandarin-shu:Шу в мандаринах:小青柑:mandarin-shu" "chenpi:Мандариновая кожура:陈皮:chenpi"; do
  IFS=':' read -r slug title cn catkey <<< "$pair"
  mkdir -p "$slug"
  cp shu-puer/index.html "$slug/index.html"
  python3 - "$slug" "$title" "$cn" "$catkey" <<'PYEOF'
import sys, pathlib
slug, title, cn, catkey = sys.argv[1:5]
p = pathlib.Path(slug) / "index.html"
text = p.read_text(encoding="utf-8")
text = text.replace(">Шу пуэр<", f">{title}<")
text = text.replace(">熟普洱<", f">{cn}<")
text = text.replace('alt="Шу пуэр"', f'alt="{title}"')
text = text.replace("categorySlug = 'shu-puer';", f"categorySlug = '{catkey}';")
p.write_text(text, encoding="utf-8")
PYEOF
done
```

- [ ] **Step 3: Проверить, что подмены прошли верно**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop"
for slug in shu-puer sheng-puer white red mandarin-shu chenpi; do
  echo "=== $slug ==="
  grep -n "categorySlug = " "$slug/index.html"
  grep -n "<h1" "$slug/index.html"
done
```
Expected: для каждой из 6 папок — своя уникальная строка `categorySlug` и свой
заголовок в `<h1>`, без дублей значения `shu-puer` там, где не надо.

- [ ] **Step 4: Ручная проверка в браузере**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop" && python3 -m http.server 8765
```
Открыть `http://localhost:8765/`, кликнуть по каждой из 6 карточек в блоке
«Шесть сортов» — убедиться, что открывается соответствующая подстраница
(не 404), заголовок совпадает с названием сорта, в блоке «Каталог» отображаются
карточки товаров (или у категорий без товаров — просто пустой грид без ошибки
в консоли браузера), фото есть у части товаров (позиции 1–27), у остальных —
серый placeholder-квадрат без разбитой иконки.

- [ ] **Step 5: Commit**

```bash
git add shu-puer sheng-puer white red mandarin-shu chenpi
git commit -m "$(cat <<'EOF'
Добавлены 6 подстраниц сортов с мини-каталогом из catalog.json

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 8: Финальная сквозная проверка

**Files:** нет новых/изменённых файлов — только верификация.

- [ ] **Step 1: Полный обход сайта**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop" && python3 -m http.server 8765
```
Пройти вручную в браузере (desktop-ширина и мобильная эмуляция 375px):
1. `/` — hero с видео проигрывается, poster не завис навсегда; порядок блоков
   сверху вниз: Hero → Фаундер (фото Сергея, цитата, кнопка) → Шесть сортов →
   Принципы → Подписка → Footer.
2. Клик «Подобрать чай» → скроллит к блоку сортов.
3. Каждая из 6 карточек сортов → открывает свою подстраницу без 404.
4. На каждой подстранице — заголовок соответствует сорту, каталог не пустой
   для категорий с товарами, нет ошибок в консоли браузера (DevTools → Console).
5. Ссылка «← Вернуться на главную» в футере подстраницы работает.
6. Мобильная ширина: `.founder-grid` и `.footer-grid` складываются в 1 колонку,
   `.nav-links` скрыты.

- [ ] **Step 2: Проверить отсутствие мусора/забытых ссылок**

```bash
cd "/Users/imac/Documents/новый/projects/tea-shop" && grep -rn 'demo1\|demo2' index.html shu-puer sheng-puer white red mandarin-shu chenpi 2>/dev/null
```
Expected: пусто (никаких ссылок на удалённые демо-папки не осталось).

- [ ] **Step 3: Финальный commit (если Step 1/2 потребовали правок)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Финальные правки после сквозной проверки редизайна tea-shop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```
Если правок не потребовалось — этот шаг пропускается, план считается выполненным
после Task 7.
