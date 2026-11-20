# Деплой-идентификаторы (НЕ секреты)

## Каталог tea-shop (новый контур, b1g7i9m9r6ibld09cess)
- sklad-api (копия): https://functions.yandexcloud.net/d4etr4bluil1qvel94jf (публичная с 20.11)
- shop-api (заказы): https://functions.yandexcloud.net/d4e8bepo2movs1ekku79 (задеплоена 20.11; **публичный вызов не включён — нужен тумблер в консоли от владельца облака**, SA deploy не имеет прав на access bindings)
- Фронт-бакет: tea-shop-site-946173 → https://tea-shop-site-946173.website.yandexcloud.net/
- YDB заказов: `tea-shop-orders` = `etn59ff8v2f6cvl02e5u`, таблица `orders` (создана 20.11, живой тест пройден)
- Document API endpoint: `https://docapi.serverless.yandexcloud.net/ru-central1/b1g474kvre57nm4js7h1/etn59ff8v2f6cvl02e5u`
- Сервисный аккаунт: deploy = aje2o8hffl4sibdu44i1
- Статический ключ (Document API/S3): id `YCAJEJV8cYYZwewCnUC9kyh5o` (секрет — в ~/.yc-keys/tea-shop-s3.json; пересоздан 20.11, старый YCAJE_7yD_... был утерян/битый файл)
- ADMIN_TOKEN магазина: в `shop-api/.deploy.env` (сгенерирован 20.11; показан автору, больше не печатать)

## Старый прод (не трогаем до переключения DNS)
- sklad-api: https://functions.yandexcloud.net/d4e6o6v2n3b9h8etfghd
- Фронт: https://antioz.github.io/tea-shop/

## 2026-11-19
- Фото 10 SKU из 产品图片 загружены в МойСклад (base64 JSON, одним массивом на товар — POST images заменяет набор).
- Фикс sklad-api: маршрут img искал товар по точному коду «TEA-001»==«1» → 404; теперь парсинг номера.
- Задеплоено: прод (d4e6o6v2n3b9h8etfghd, профиль default) + новый контур (d4etr4bluil1qvel94jf).
- Ключи СДЭК (боевые) — в ~/.yc-keys/cdek.json, ждут shop-api.
