import { fetch } from 'wix-fetch';
import { products, collections } from 'wix-stores.v2';
import { ELEADS_CONFIG } from 'backend/eleads-config';

const API_BASE_URL = ELEADS_CONFIG.api_base_url;
const API_TOKEN = ELEADS_CONFIG.api_token;
const SITE_URL = ELEADS_CONFIG.site_url;
const LANGUAGE = ELEADS_CONFIG.language;
const DEFAULT_CURRENCY = ELEADS_CONFIG.currency;
const DEFAULT_CATEGORY = ELEADS_CONFIG.default_category;
const WIX_DEFAULT_CATEGORY_IDS = ELEADS_CONFIG.wix_default_category_ids;
const WIX_DEFAULT_CATEGORY_NAMES = ELEADS_CONFIG.wix_default_category_names;

function stripHtml(html = '') {
  return String(html).replace(/<[^>]*>/g, '').trim();
}

function isDefaultWixCategory(id, name = '') {
  return (
    WIX_DEFAULT_CATEGORY_IDS.includes(id) ||
    WIX_DEFAULT_CATEGORY_NAMES.includes(String(name).toLowerCase().trim())
  );
}

function getPrice(product) {
  const value =
    product.priceData?.price ??
    product.priceData?.discountedPrice ??
    product.price?.price ??
    product.price?.discountedPrice ??
    product.price?.amount ??
    product.price ??
    product.discountedPrice;

  if (typeof value === 'object' || value === undefined || value === null) {
    return 0;
  }

  return Number(value) || 0;
}

function getProductUrl(product) {
  if (typeof product.productPageUrl === 'string') {
    if (product.productPageUrl.startsWith('http')) {
      return product.productPageUrl;
    }

    return `${SITE_URL}${product.productPageUrl}`;
  }

  if (product.productPageUrl?.base && product.productPageUrl?.path) {
    const base = product.productPageUrl.base.replace(/\/$/, '');
    const path = product.productPageUrl.path.startsWith('/')
      ? product.productPageUrl.path
      : `/${product.productPageUrl.path}`;

    return `${base}${path}`;
  }

  return '';
}

function getImage(product) {
  return product.media?.mainMedia?.image?.url || '';
}

function getCategoryId(product) {
  const collection_ids = product.collectionIds || product.collections || [];

  if (Array.isArray(collection_ids) && collection_ids.length) {
    const first = collection_ids[0];

    if (typeof first === 'string') {
      return first;
    }

    return first._id || first.id || null;
  }

  return null;
}

function getEventProductId(event) {
  return event.productId || event._id || event.id || event.product?._id || event.product?.id;
}

function buildCategoryPayload(category_id, category = null) {
  if (!category_id || isDefaultWixCategory(category_id, category?.name || '')) {
    return {
      external_id: DEFAULT_CATEGORY.id,
      external_name: DEFAULT_CATEGORY.name,
      external_url: DEFAULT_CATEGORY.url,
      external_parent_id: '',
      external_parent_name: '',
      external_parent_url: '',
      full_path: DEFAULT_CATEGORY.full_path,
      position: DEFAULT_CATEGORY.position,
      parent_position: 0,
      path: DEFAULT_CATEGORY.path
    };
  }

  return {
    external_id: String(category_id),
    external_name: category?.name || DEFAULT_CATEGORY.name,
    external_url: category?.collectionPageUrl || '',
    external_parent_id: '',
    external_parent_name: '',
    external_parent_url: '',
    full_path: category?.name || DEFAULT_CATEGORY.full_path,
    position: 0,
    parent_position: 0,
    path: category?.name ? [category.name] : DEFAULT_CATEGORY.path
  };
}

function buildPayload(product, category = null) {
  const external_id = String(product._id || product.id);
  const url = getProductUrl(product);
  const image = getImage(product);
  const in_stock = product.stock?.inStock ?? product.inStock ?? false;
  const quantity = product.stock?.quantity ?? (in_stock ? 1000 : 0);
  const description = stripHtml(product.description || '');
  const category_id = getCategoryId(product);

  return {
    language: LANGUAGE,
    external_id,
    payload: {
      source: {
        offer_id: external_id,
        language: LANGUAGE,
        url,
        group_id: '1'
      },
      product: {
        title: product.name || '',
        description,
        short_description: product.name || '',
        price: getPrice(product),
        old_price: 0,
        currency: product.priceData?.currency || product.currency || DEFAULT_CURRENCY,
        quantity,
        stock_status: in_stock ? 'В наявності' : 'Немає в наявності',
        vendor: product.brand || '',
        sku: product.sku || '',
        label: '',
        sort_order: 0,
        attributes: {
          sku: product.sku || '',
          brand: product.brand || ''
        },
        attribute_filters: [],
        images: image ? [image] : []
      },
      category: buildCategoryPayload(category_id, category)
    }
  };
}

async function sendToELeads(method, url, body) {
  console.log('E_LEADS_REQUEST:', method, url, JSON.stringify(body));

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();

  console.log('E_LEADS_RESPONSE:', res.status, text);

  if (!res.ok) {
    console.error('E_LEADS_SYNC_ERROR:', res.status, text);
  }

  return text;
}

async function getProductById(product_id) {
  try {
    const result = await products.getProduct(product_id);
    return result.product || result;
  } catch (error) {
    console.warn('E_LEADS_PRODUCT_NOT_FOUND:', product_id, error.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCategoryById(category_id) {
  if (!category_id) {
    return null;
  }

  try {
    const result = await collections.getCollection(category_id);
    return result.collection || result;
  } catch (error) {
    console.error('E_LEADS_CATEGORY_GET_ERROR:', category_id, error.message);
    return null;
  }
}

async function getProductByIdWithRetry(product_id, attempts = 5, delay = 2000) {
  for (let i = 1; i <= attempts; i++) {
    const product = await getProductById(product_id);

    if (product) {
      return product;
    }

    console.warn(`E_LEADS_PRODUCT_RETRY ${i}/${attempts}:`, product_id);
    await sleep(delay);
  }

  return null;
}

async function syncProduct(product_id, action) {
  console.log('E_LEADS_SYNC_START:', action, product_id);

  if (action === 'create' || action === 'update') {
    await sleep(3000);
  }

  const product = await getProductByIdWithRetry(product_id);

  if (!product) {
    console.warn('E_LEADS_SYNC_SKIPPED_PRODUCT_NOT_FOUND:', action, product_id);
    return;
  }

  const category_id = getCategoryId(product);
  const category = await getCategoryById(category_id);
  const payload = buildPayload(product, category);

  console.log('E_LEADS_PAYLOAD:', JSON.stringify(payload, null, 2));

  if (action === 'create') {
    return sendToELeads('POST', `${API_BASE_URL}/ecommerce/items`, payload);
  }

  if (action === 'update') {
    return sendToELeads(
      'PUT',
      `${API_BASE_URL}/ecommerce/items/${encodeURIComponent(payload.external_id)}`,
      payload
    );
  }
}

export async function wixStores_onProductCreated(event) {
  console.log('E_LEADS_PRODUCT_CREATED_EVENT:', JSON.stringify(event));

  const product_id = getEventProductId(event);

  if (!product_id) {
    console.error('E_LEADS_CREATE_NO_PRODUCT_ID:', JSON.stringify(event));
    return;
  }

  return syncProduct(product_id, 'create');
}

export async function wixStores_onProductUpdated(event) {
  console.log('E_LEADS_PRODUCT_UPDATED_EVENT:', JSON.stringify(event));

  const product_id = getEventProductId(event);

  if (!product_id) {
    console.error('E_LEADS_UPDATE_NO_PRODUCT_ID:', JSON.stringify(event));
    return;
  }

  return syncProduct(product_id, 'update');
}

export async function wixStores_onProductDeleted(event) {
  console.log('E_LEADS_PRODUCT_DELETED_EVENT:', JSON.stringify(event));

  const product_id = getEventProductId(event);

  if (!product_id) {
    console.error('E_LEADS_DELETE_NO_PRODUCT_ID:', JSON.stringify(event));
    return;
  }

  return sendToELeads(
    'DELETE',
    `${API_BASE_URL}/ecommerce/items/${encodeURIComponent(String(product_id))}`,
    {
      language: LANGUAGE
    }
  );
}