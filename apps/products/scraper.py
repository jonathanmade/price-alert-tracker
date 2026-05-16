import re
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

AMAZON_DOMAINS = {"amazon.es", "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it"}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "DNT": "1",
}

# Selectores específicos por dominio
SITE_SELECTORS = {
    "amazon.es": [
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        "#corePrice_feature_div .a-price .a-offscreen",
        "#apex_desktop .a-price .a-offscreen",
        "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
        "#buybox .a-price .a-offscreen",
        "#ppd .a-price .a-offscreen",
        ".a-price .a-offscreen",
        "#price_inside_buybox",
        "#newBuyBoxPrice",
    ],
    "mediamarkt.es": [
        "[data-test='branded-price-without-rrp'] span",
        ".price-wrapper span",
        "span[class*='StyledPrice']",
    ],
    "elcorteingles.es": [
        ".sale-price",
        ".price__sale",
        "[itemprop='price']",
    ],
    "pccomponentes.com": [
        "#precio-oferta",
        ".price-hero",
        "[data-price]",
    ],
    "zara.com": [
        ".price__amount--sale",
        ".price__amount",
        "[class*='price-current']",
    ],
    "asos.com": [
        "[data-id='current-price']",
        ".current-price",
    ],
}

# Selectores genéricos como fallback (schema.org y patrones comunes)
GENERIC_SELECTORS = [
    "[itemprop='price']",
    "[data-price]",
    ".price",
    ".product-price",
    ".current-price",
    "#price",
    ".offer-price",
]


def _extract_price(text: str) -> float | None:
    text = text.strip().replace("\xa0", " ")
    match = re.search(r"[\d]+[.,][\d]{2}", text)
    if not match:
        match = re.search(r"[\d]+", text)
    if not match:
        return None
    raw = match.group().replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def _get_domain(url: str) -> str:
    host = urlparse(url).netloc
    return host.replace("www.", "")


def _get_soup(url: str) -> BeautifulSoup | None:
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        response = session.get(url, timeout=15, allow_redirects=True)
        response.raise_for_status()
        text = response.text
        if "captcha" in text.lower() or "robot check" in text.lower() or "validatecaptcha" in text.lower():
            return None
        return BeautifulSoup(text, "html.parser")
    except requests.RequestException:
        return None


def _price_from_json_ld(soup: BeautifulSoup) -> float | None:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(data, list):
            data = data[0]
        offers = data.get("offers") or data.get("Offers")
        if isinstance(offers, list):
            offers = offers[0]
        if isinstance(offers, dict):
            price = offers.get("price") or offers.get("lowPrice")
            if price is not None:
                return _extract_price(str(price))
        elif isinstance(data, dict):
            price = data.get("price")
            if price is not None:
                return _extract_price(str(price))
    return None


def _price_from_next_data(soup: BeautifulSoup) -> float | None:
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        return None
    try:
        data = json.loads(script.string)
    except (json.JSONDecodeError, TypeError):
        return None

    raw = json.dumps(data)
    for key in ("price", "currentPrice", "salePrice", "finalPrice", "offerPrice"):
        pattern = rf'"{key}"\s*:\s*([\d]+\.?[\d]*)'
        match = re.search(pattern, raw)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def _price_from_soup(soup: BeautifulSoup, url: str) -> float | None:
    # 1. meta itemprop
    meta = soup.find("meta", {"itemprop": "price"})
    if meta and meta.get("content"):
        price = _extract_price(meta["content"])
        if price:
            return price

    # 2. og:price:amount
    og_price = soup.find("meta", property="og:price:amount")
    if og_price and og_price.get("content"):
        price = _extract_price(og_price["content"])
        if price:
            return price

    # 3. JSON-LD (schema.org)
    price = _price_from_json_ld(soup)
    if price:
        return price

    # 4. __NEXT_DATA__ (Next.js — MediaMarkt, etc.)
    price = _price_from_next_data(soup)
    if price:
        return price

    # 5. Selectores CSS por dominio + genéricos
    domain = _get_domain(url)
    site_selectors = SITE_SELECTORS.get(domain, [])

    for selector in site_selectors + GENERIC_SELECTORS:
        element = soup.select_one(selector)
        if not element:
            continue
        text = element.get("content") or element.get("data-price") or element.get_text()
        price = _extract_price(text)
        if price:
            return price

    return None


def _get_soup_playwright(url: str) -> BeautifulSoup | None:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                locale="es-ES",
                extra_http_headers={"Accept-Language": "es-ES,es;q=0.9"},
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(2000)
            html = page.content()
            browser.close()
        if "captcha" in html.lower() or "validatecaptcha" in html.lower():
            return None
        return BeautifulSoup(html, "html.parser")
    except Exception:
        return None


def _get_soup_for(url: str) -> BeautifulSoup | None:
    domain = _get_domain(url)
    if domain in AMAZON_DOMAINS:
        soup = _get_soup_playwright(url)
        if soup is not None:
            return soup
    return _get_soup(url)


def scrape_price(url: str) -> float | None:
    soup = _get_soup_for(url)
    if soup is None:
        return None
    return _price_from_soup(soup, url)


def scrape_metadata(url: str) -> dict:
    soup = _get_soup_for(url)
    if soup is None:
        return {}

    name = None
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        name = og_title["content"].strip()
    if not name:
        title_tag = soup.find("title")
        if title_tag:
            name = title_tag.get_text().strip()

    image_url = None
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        image_url = og_image["content"].strip()

    price = _price_from_soup(soup, url)

    return {"name": name, "image_url": image_url, "price": price}
