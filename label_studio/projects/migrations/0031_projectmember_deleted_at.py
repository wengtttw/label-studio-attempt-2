from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0030_project_search_vector_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectmember',
            name='deleted_at',
            field=models.DateTimeField(blank=True, default=None, help_text='Soft delete timestamp', null=True),
        ),
    ]
