import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-ES,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Selectores específicos por dominio
SITE_SELECTORS = {
    "amazon.es": [
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".a-price .a-offscreen",
        "#apex_desktop .a-price .a-offscreen",
        "#corePrice_feature_div .a-price .a-offscreen",
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
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")
    except requests.RequestException:
        return None


def _price_from_soup(soup: BeautifulSoup, url: str) -> float | None:
    meta = soup.find("meta", {"itemprop": "price"})
    if meta and meta.get("content"):
        price = _extract_price(meta["content"])
        if price:
            return price

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


def scrape_price(url: str) -> float | None:
    soup = _get_soup(url)
    if soup is None:
        return None
    return _price_from_soup(soup, url)


def scrape_metadata(url: str) -> dict:
    soup = _get_soup(url)
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
