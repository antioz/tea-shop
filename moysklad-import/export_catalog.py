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
