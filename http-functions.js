import { response, serverError } from 'wix-http-functions';
import { products, collections } from 'wix-stores.v2';
import { ELEADS_CONFIG } from 'backend/eleads-config';

const SITE_URL = ELEADS_CONFIG.site_url;
const SHOP_NAME = ELEADS_CONFIG.shop_name;
const SHOP_EMAIL = ELEADS_CONFIG.shop_email;
const LANGUAGE = ELEADS_CONFIG.language;
const DEFAULT_CURRENCY = ELEADS_CONFIG.currency;
const DEFAULT_CATEGORY = ELEADS_CONFIG.default_category;
const WIX_DEFAULT_CATEGORY_IDS = ELEADS_CONFIG.wix_default_category_ids;
const WIX_DEFAULT_CATEGORY_NAMES = ELEADS_CONFIG.wix_default_category_names;

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanParamValue(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')        // убрать HTML
    .replace(/&quot;|&#34;/g, '')   // убрать "
    .replace(/&amp;/g, '&')        // вернуть &
    .replace(/[\"']/g, '')         // убрать кавычки
    .replace(/\s+/g, ' ')          // лишние пробелы
    .trim();
}

function stripHtml(html = '') {
  return String(html).replace(/<[^>]*>/g, '').trim();
}

function isDefaultWixCategory(id, name = '') {
  return (
    WIX_DEFAULT_CATEGORY_IDS.includes(id) ||
    WIX_DEFAULT_CATEGORY_NAMES.includes(String(name).toLowerCase().trim())
  );
}

function getProductUrl(product) {
  if (typeof product.productPageUrl === 'string') {
    return product.productPageUrl.startsWith('http')
      ? product.productPageUrl
      : `${SITE_URL}${product.productPageUrl}`;
  }

  if (product.productPageUrl?.base && product.productPageUrl?.path) {
    const base = product.productPageUrl.base.replace(/\/$/, '');
    const path = product.productPageUrl.path.startsWith('/')
      ? product.productPageUrl.path
      : `/${product.productPageUrl.path}`;

    return `${base}${path}`;
  }

  return `${SITE_URL}/product-page/${product.slug || product._id}`;
}

function getImage(product) {
  return product.media?.mainMedia?.image?.url || '';
}

function getPrice(product) {
  const value =
    product.priceData?.price ??
    product.priceData?.discountedPrice ??
    product.price?.price ??
    product.price?.discountedPrice ??
    product.price?.amount ??
    product.price;

  if (typeof value === 'object' || value == null) return 0;

  return value;
}

async function getAllProducts() {
  let all = [];

  let result = await products.queryProducts().limit(100).find();
  all.push(...(result.items || []));

  while (result.hasNext()) {
    result = await result.next();
    all.push(...(result.items || []));
  }

  return all;
}

async function getAllCollections() {
  try {
    let all = [];

    let result = await collections.queryCollections().limit(100).find();
    all.push(...(result.items || []));

    while (result.hasNext()) {
      result = await result.next();
      all.push(...(result.items || []));
    }

    return all;
  } catch (e) {
    return [];
  }
}

function filterCollections(all_collections) {
  return all_collections.filter((category) => {
    const id = category._id || category.id;
    const name = category.name || '';

    return !isDefaultWixCategory(id, name);
  });
}

function buildCategoriesXml(all_collections) {
  const filtered = filterCollections(all_collections);

  const default_category_xml = `<category id="${escapeXml(DEFAULT_CATEGORY.id)}" position="${escapeXml(DEFAULT_CATEGORY.position)}" url="${escapeXml(DEFAULT_CATEGORY.url)}">${escapeXml(DEFAULT_CATEGORY.name)}</category>`;

  const categories_xml = filtered.map((category, index) => {
    const id = category._id || category.id || index + 1;
    const name = category.name || DEFAULT_CATEGORY.name;
    const url = category.collectionPageUrl || SITE_URL;

    return `<category id="${escapeXml(id)}" position="${index + 2}" url="${escapeXml(url)}">${escapeXml(name)}</category>`;
  }).join('\n');

  return categories_xml
    ? `${default_category_xml}\n${categories_xml}`
    : default_category_xml;
}

function getCategoryId(product, all_collections) {
  const ids = product.collectionIds || product.collections || [];

  if (Array.isArray(ids) && ids.length) {
    const first = ids[0];

    const id = typeof first === 'string'
      ? first
      : first._id || first.id;

    const category = all_collections.find((item) => {
      const collection_id = item._id || item.id;
      return collection_id === id;
    });

    const category_name = category?.name || '';

    if (!id || isDefaultWixCategory(id, category_name)) {
      return DEFAULT_CATEGORY.id;
    }

    return id;
  }

  return DEFAULT_CATEGORY.id;
}

function buildParamsXml(product) {
  const sections = product.additionalInfoSections || [];

  if (!Array.isArray(sections)) return '';

  return sections.map(section => {
    const name = section.title || '';
    const value = cleanParamValue(section.description || '');

    return `<param name="${escapeXml(name)}">${escapeXml(value)}</param>`;
  }).join('\n');
}

function buildOffersXml(all_products, all_collections) {
  return all_products.map((product, index) => {
    const id = product._id || product.id;
    const price = getPrice(product);
    const currency = product.priceData?.currency || DEFAULT_CURRENCY;
    const in_stock = product.stock?.inStock ?? product.inStock ?? false;
    const quantity = product.stock?.quantity ?? (in_stock ? 1000 : 0);
    const available = in_stock ? 'true' : 'false';
    const stock_status = in_stock ? 'В наявності' : 'Немає в наявності';
    const url = getProductUrl(product);
    const image = getImage(product);
    const category_id = getCategoryId(product, all_collections);
    const description = stripHtml(product.description || product.name || '');
    const params = buildParamsXml(product);
    const vendor = product.brand || '';

    return `<offer id="${escapeXml(id)}" available="${available}">
  <url>${escapeXml(url)}</url>
  <name>${escapeXml(product.name || '')}</name>
  <price>${escapeXml(price)}</price>
  <old_price></old_price>
  <currency>${escapeXml(currency)}</currency>
  <categoryId>${escapeXml(category_id || '')}</categoryId>
  <quantity>${escapeXml(quantity)}</quantity>
  <stock_status>${escapeXml(stock_status)}</stock_status>
  <picture>${escapeXml(image || '')}</picture>
  <vendor>${escapeXml(vendor)}</vendor>
  <sku>${escapeXml(product.sku || '')}</sku>
  <label></label>
  <order>${index + 1}</order>
  <description>${escapeXml(description)}</description>
  <short_description>${escapeXml(product.name || '')}</short_description>
  ${params}
</offer>`;
  }).join('\n');
}

export async function get_eLeadsFeed() {
  try {
    const all_products = await getAllProducts();
    const all_collections = await getAllCollections();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${now}">
  <shop>
    <shopName>${escapeXml(SHOP_NAME)}</shopName>
    <email>${escapeXml(SHOP_EMAIL)}</email>
    <url>${escapeXml(SITE_URL)}</url>
    <language>${escapeXml(LANGUAGE)}</language>
    <categories>
${buildCategoriesXml(all_collections)}
    </categories>
    <offers>
${buildOffersXml(all_products, all_collections)}
    </offers>
  </shop>
</yml_catalog>`;

    return response({
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8'
      },
      body: xml
    });

  } catch (error) {
    return serverError({
      body: { error: error.message }
    });
  }
}
