"""Выгрузка товаров из МойСклада в каталог сайта.

Тянет все товары по API, качает фото из склада, подставляет цены/спецификации
из items.json (в МойСклад цены не заведены — 0), пишет catalog.json.

Скрытые категории (не публикуем на сайте): chenpi, mandarin-shu.

Запуск: python3 fetch_from_moysklad.py
Токен: файл .token рядом (в git не входит).
"""
import json
import sys
from pathlib import Path

import requests

BASE = "https://api.moysklad.ru/api/remap/1.2"
HERE = Path(__file__).parent
ITEMS_FILE = HERE / "items.json"
TOKEN_FILE = HERE / ".token"
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
    10: "chenpi",
    26: "mandarin-shu",
    27: "mandarin-shu",
}

# категории, которые показываем на сайте (chenpi/mandarin-shu скрыты)
SITE_CATEGORIES = ["shu-puer", "sheng-puer", "white", "red"]

HIDDEN = {"chenpi", "mandarin-shu"}


def session():
    token = TOKEN_FILE.read_text().strip()
    if not token:
        sys.exit("Нет токена в .token")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {token}"
    s.headers["Accept-Encoding"] = "gzip"
    return s


def fetch_products(s):
    products = []
    offset = 0
    while True:
        r = s.get(f"{BASE}/entity/product", params={"limit": 100, "offset": offset})
        r.raise_for_status()
        rows = r.json()["rows"]
        products.extend(rows)
        if len(rows) < 100:
            return products
        offset += 100


def download_photo(s, product, dest_dir, num):
    href = product["meta"]["href"] + "/images"
    r = s.get(href)
    r.raise_for_status()
    rows = r.json().get("rows", [])
    if not rows:
        return None
    ext = rows[0].get("filename", "img.jpg").rsplit(".", 1)[-1].lower()
    if ext == "jpeg":
        ext = "jpg"
    dest = dest_dir / f"{num}.{ext}"
    dl = requests.get(
        rows[0]["meta"]["downloadHref"],
        headers={"Authorization": s.headers["Authorization"], "Accept": "application/json;charset=utf-8"},
        timeout=60,
    )
    dl.raise_for_status()
    dest.write_bytes(dl.content)
    return f"catalog-photos/{num}.{ext}"


def main():
    s = session()
    products = fetch_products(s)
    items = {it["num"]: it for it in json.loads(ITEMS_FILE.read_text(encoding="utf-8"))}

    CATALOG_PHOTOS_DIR.mkdir(exist_ok=True)
    catalog = {slug: [] for slug in SITE_CATEGORIES}
    skipped = []

    for p in products:
        num = int(p["code"])
        item = items.get(num, {})
        site_category = OVERRIDES.get(num) or BASE_MAP.get(p.get("pathName", ""))
        if not site_category:
            skipped.append((num, p.get("pathName")))
            continue

        img = download_photo(s, p, CATALOG_PHOTOS_DIR, num)
        entry = {
            "num": num,
            "name": p["name"],
            "price_rub": item.get("price_rub"),
            "spec": item.get("spec"),
            "unit": item.get("unit"),
            "img": img,
        }
        if site_category in HIDDEN:
            continue
        catalog[site_category].append(entry)

    for slug in SITE_CATEGORIES:
        catalog[slug].sort(key=lambda e: e["num"])

    CATALOG_FILE.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    total = sum(len(v) for v in catalog.values())
    print(f"catalog.json: {total} позиций по {len(SITE_CATEGORIES)} категориям")
    for slug in SITE_CATEGORIES:
        print(f"  {slug}: {len(catalog[slug])}")
    hidden_count = sum(1 for v in OVERRIDES.values() if v in HIDDEN)
    print(f"скрыто (не в каталоге): {hidden_count} позиций категорий chenpi/mandarin-shu")
    if skipped:
        print("пропущены без категории:", skipped)


if __name__ == "__main__":
    main()
