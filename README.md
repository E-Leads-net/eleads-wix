# Интеграция Wix → E-Leads

В этой инструкции описано подключение Wix Stores к E-Leads: генерация товарного фида и автоматическая синхронизация товаров при добавлении, обновлении и удалении.

---

## Что делает интеграция

После подключения E-Leads получает данные о товарах из Wix:

- через XML/YML фид для первичной загрузки каталога;
- через backend events для автоматической синхронизации изменений;
- товары используются в Smart Search, AI-чате и других инструментах E-Leads.

---

## Что нужно для подключения

Перед началом убедитесь, что у вас есть:

- сайт на Wix;
- установленный Wix Stores;
- доступ к редактору сайта;
- API-ключ проекта E-Leads.

---

## Какие файлы будут использоваться

В Wix нужно будет добавить 3 backend-файла:

```text
backend/eleads-config.js
backend/http-functions.js
backend/events.js
```

Назначение файлов:

| Файл | Для чего нужен |
|---|---|
| `eleads-config.js` | Общие настройки интеграции |
| `http-functions.js` | Генерация XML/YML фида |
| `events.js` | Синхронизация товаров create/update/delete |

---

## Шаг 1. Открыть редактор Wix

1. Откройте Wix Dashboard.
2. Нажмите **Edit Site**.
3. В редакторе включите режим разработчика:

```text
Dev Mode → Turn on Dev Mode
```

После этого слева появится раздел **Backend & Public**.

---

## Шаг 2. Добавить файл конфигурации

В левой панели откройте:

```text
Backend → + → Add .js file
```

Назовите файл:

```text
eleads-config.js
```

Вставьте код конфигурации:

```js
export const ELEADS_CONFIG = {
  site_url: 'https://your-site.com',
  shop_name: 'Your Shop Name',
  shop_email: '',
  language: 'uk',
  currency: 'UAH',

  api_base_url: 'https://dashboard.e-leads.net/api',
  api_token: 'YOUR_E_LEADS_API_TOKEN',

  default_category: {
    id: 'eleads-default-category',
    name: 'Товари',
    url: 'https://your-site.com',
    full_path: 'Товари',
    position: 1,
    path: ['Товари']
  },

  wix_default_category_ids: [
    '00000000-000000-000000-000000000001',
    '00000000-0000-0000-0000-000000000001'
  ],

  wix_default_category_names: [
    'all products'
  ]
};
```

### Что заменить

Обязательно замените:

```js
site_url: 'https://your-site.com'
shop_name: 'Your Shop Name'
api_token: 'YOUR_E_LEADS_API_TOKEN'
```

Например:

```js
site_url: 'https://www.example.com'
shop_name: 'Example Store'
api_token: 'ваш API ключ E-Leads'
```

### Дефолтная категория

Если товар в Wix находится только в системной категории **All Products**, E-Leads будет использовать дефолтную категорию из конфига:

```js
default_category: {
  id: 'eleads-default-category',
  name: 'Товари'
}
```

Название можно изменить, например:

```js
name: 'Каталог'
```

---

## Шаг 3. Добавить файл фида

Файл `http-functions.js` лучше создавать через специальный пункт Wix.

В левой панели откройте:

```text
Backend → + → Expose site API
```

Wix создаст файл:

```text
backend/http-functions.js
```

Если файл уже существует, откройте его и замените содержимое на код фида E-Leads.

Этот файл создаёт публичную ссылку фида:

```text
https://your-site.com/_functions/eLeadsFeed
```

Фид используется для первичной загрузки всех товаров в E-Leads.

---

## Шаг 4. Добавить файл синхронизации

Файл `events.js` тоже лучше создавать через специальный пункт Wix.

В левой панели откройте:

```text
Backend → + → Handle backend events
```

Выберите события Wix Stores:

```text
Product Created
Product Updated
Product Deleted
```

Wix создаст файл:

```text
backend/events.js
```

Если файл уже существует, откройте его и замените содержимое на код синхронизации E-Leads.

Этот файл отвечает за автоматическую отправку изменений товара в E-Leads.

---

## Шаг 5. Опубликовать сайт

После добавления всех файлов нажмите:

```text
Save → Publish
```

Важно: backend events в Wix работают только на опубликованном сайте.

---

## Шаг 6. Проверить фид

Откройте ссылку:

```text
https://your-site.com/_functions/eLeadsFeed
```


Если всё работает, вы увидите XML/YML фид:

```xml
<yml_catalog>
  <shop>
    <categories>
      ...
    </categories>
    <offers>
      ...
    </offers>
  </shop>
</yml_catalog>
```

---

## Шаг 7. Проверить синхронизацию

1. В Wix Dashboard откройте товары.
2. Добавьте новый товар или измените существующий.
3. Откройте:

```text
Developer Tools → Logging Tools → Wix Logs
```

В логах должны появиться записи:

```text
E_LEADS_PRODUCT_CREATED_EVENT
E_LEADS_PRODUCT_UPDATED_EVENT
E_LEADS_PRODUCT_DELETED_EVENT
E_LEADS_REQUEST
E_LEADS_RESPONSE: 202 {"status":"accepted"}
```

Ответ `202 accepted` означает, что E-Leads принял задачу на обработку.

---

## Как работает синхронизация

| Действие в Wix | Запрос в E-Leads |
|---|---|
| Добавлен товар | `POST /api/ecommerce/items` |
| Обновлён товар | `PUT /api/ecommerce/items/{external_id}` |
| Удалён товар | `DELETE /api/ecommerce/items/{external_id}` |

---

## Что передаётся в E-Leads

При создании или обновлении товара передаются:

- название товара;
- описание;
- короткое описание;
- цена;
- валюта;
- остаток;
- статус наличия;
- SKU;
- изображения;
- категория;
- дополнительные параметры товара.

Дополнительные поля Wix из блока **Additional Info Sections** передаются в фиде как:

```xml
<param name="Виробник">Пфайзер</param>
```

---

## Важные особенности Wix

### Системная категория All Products

Wix создаёт системную категорию:

```text
All Products
```

Она не всегда локализуется и может приходить через API как обычная категория.

В конфиге она заменяется на вашу дефолтную категорию:

```js
default_category: {
  id: 'eleads-default-category',
  name: 'Товари'
}
```

### Задержка при обновлении товара

Wix может отправить событие раньше, чем товар полностью доступен через API. Поэтому в синхронизации используется небольшая задержка и повторная проверка.

### Удаление товара

После удаления Wix может дополнительно отправить событие обновления. Если товар уже удалён, интеграция просто пропускает это событие.

---

## Безопасность

Код размещается в backend-файлах Wix:

```text
backend/events.js
backend/http-functions.js
backend/eleads-config.js
```

Эти файлы не доступны пользователям с фронта и не отображаются в браузере.

Для production рекомендуется хранить API-ключ через Wix Secrets Manager.

---

## Проверочный список

Перед завершением настройки проверьте:

- Dev Mode включён;
- создан `backend/eleads-config.js`;
- создан `backend/http-functions.js` через **Expose site API**;
- создан `backend/events.js` через **Handle backend events**;
- в конфиге указан правильный `site_url`;
- в конфиге указан правильный `api_token`;
- сайт опубликован через **Publish**;
- фид открывается по ссылке;
- в Wix Logs появляется `E_LEADS_RESPONSE: 202`.

---

## Если интеграция не работает

Проверьте:

1. Сайт опубликован, а не только сохранён.
2. API-ключ E-Leads указан правильно.
3. Фид открывается по ссылке.
4. В Wix Logs есть записи `E_LEADS_REQUEST`.
5. Товар не находится только в черновике Wix.
6. У товара есть цена и название.

---

## Результат

После подключения:

- E-Leads получает полный каталог товаров;
- поиск работает по товарам Wix;
- AI-чат может использовать товарные данные;
- изменения в Wix автоматически попадают в E-Leads;
- удалённые товары удаляются из поиска.
