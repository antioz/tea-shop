# Деплой-идентификаторы (НЕ секреты)

## Каталог tea-shop (новый контур, b1g7i9m9r6ibld09cess)
- sklad-api (копия): https://functions.yandexcloud.net/d4etr4bluil1qvel94jf
- Фронт-бакет: tea-shop-site-946173 → https://tea-shop-site-946173.website.yandexcloud.net/
- Сервисный аккаунт: deploy = aje2o8hffl4sibdu44i1
- Статический S3-ключ id: YCAJE_7yD_luzz4t4QmtGIgeU (секрет — в ~/.yc-keys; новый: `yc iam access-key create --service-account-id aje2o8hffl4sibdu44i1`)

## Старый прод (не трогаем до переключения DNS)
- sklad-api: https://functions.yandexcloud.net/d4e6o6v2n3b9h8etfghd
- Фронт: https://antioz.github.io/tea-shop/

## 2026-11-19
- Фото 10 SKU из 产品图片 загружены в МойСклад (base64 JSON, одним массивом на товар — POST images заменяет набор).
- Фикс sklad-api: маршрут img искал товар по точному коду «TEA-001»==«1» → 404; теперь парсинг номера.
- Задеплоено: прод (d4e6o6v2n3b9h8etfghd, профиль default) + новый контур (d4etr4bluil1qvel94jf).
- Ключи СДЭК (боевые) — в ~/.yc-keys/cdek.json, ждут shop-api.
