from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_coupon"),
    ]

    operations = [
        migrations.AddField(
            model_name="referenceproduct",
            name="featured",
            field=models.BooleanField(
                default=False,
                help_text="Mostrar en el reel de la landing page.",
            ),
        ),
    ]
