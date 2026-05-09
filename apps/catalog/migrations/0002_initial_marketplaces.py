from django.db import migrations


MARKETPLACES = [
    {"name": "Amazon.es",         "slug": "amazon",         "base_url": "https://www.amazon.es"},
    {"name": "PCComponentes",     "slug": "pccomponentes",  "base_url": "https://www.pccomponentes.com"},
    {"name": "MediaMarkt",        "slug": "mediamarkt",     "base_url": "https://www.mediamarkt.es"},
    {"name": "El Corte Inglés",   "slug": "elcorteingles",  "base_url": "https://www.elcorteingles.es"},
    {"name": "Carrefour",         "slug": "carrefour",      "base_url": "https://www.carrefour.es"},
]

CATEGORIES = [
    {"name": "Electrónica",       "slug": "electronica"},
    {"name": "Informática",       "slug": "informatica"},
    {"name": "Móviles",           "slug": "moviles"},
    {"name": "Audio y vídeo",     "slug": "audio-video"},
    {"name": "Electrodomésticos", "slug": "electrodomesticos"},
    {"name": "Moda",              "slug": "moda"},
    {"name": "Hogar",             "slug": "hogar"},
    {"name": "Deporte",           "slug": "deporte"},
]


def seed(apps, schema_editor):
    Marketplace = apps.get_model("catalog", "Marketplace")
    Category    = apps.get_model("catalog", "Category")
    for m in MARKETPLACES:
        Marketplace.objects.get_or_create(slug=m["slug"], defaults=m)
    for c in CATEGORIES:
        Category.objects.get_or_create(slug=c["slug"], defaults=c)


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations   = [migrations.RunPython(seed, unseed)]
