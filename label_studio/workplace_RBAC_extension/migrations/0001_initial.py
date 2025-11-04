# Generated migration for workplace_RBAC_extension

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('organizations', '0007_add_role_field'),
        ('projects', '0030_project_search_vector_index'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Workspace',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(help_text='Workspace name', max_length=500, verbose_name='title')),
                ('description', models.TextField(blank=True, default='', help_text='Workspace description', verbose_name='description')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='updated at')),
                ('deleted_at', models.DateTimeField(blank=True, db_index=True, default=None, help_text='Timestamp when workspace was deleted (null if active)', null=True, verbose_name='deleted at')),
                ('created_by', models.ForeignKey(blank=True, help_text='User who created this workspace', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_workspaces', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(help_text='Organization this workspace belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='workspaces', to='organizations.organization')),
            ],
            options={
                'db_table': 'workspace',
                'ordering': ['title'],
            },
        ),
        migrations.CreateModel(
            name='WorkspaceProject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.IntegerField(default=0, help_text='Display order in workspace UI', verbose_name='position')),
                ('added_at', models.DateTimeField(auto_now_add=True, verbose_name='added at')),
                ('added_by', models.ForeignKey(blank=True, help_text='User who added project to workspace', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(help_text='Project in this workspace', on_delete=django.db.models.deletion.CASCADE, related_name='workspace_memberships', to='projects.project')),
                ('workspace', models.ForeignKey(help_text='Workspace containing this project', on_delete=django.db.models.deletion.CASCADE, related_name='workspace_projects', to='Workspace')),
            ],
            options={
                'db_table': 'workspace_project',
                'ordering': ['position', 'added_at'],
            },
        ),
        migrations.CreateModel(
            name='WorkspaceMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role_override', models.CharField(blank=True, help_text='Optional role override for this workspace (defaults to org role)', max_length=20, null=True, verbose_name='role override')),
                ('enabled', models.BooleanField(default=True, help_text='Whether this membership is active', verbose_name='enabled')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='updated at')),
                ('user', models.ForeignKey(help_text='User with workspace access', on_delete=django.db.models.deletion.CASCADE, related_name='workspace_memberships', to=settings.AUTH_USER_MODEL)),
                ('workspace', models.ForeignKey(help_text='Workspace the user belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='members', to='Workspace')),
            ],
            options={
                'db_table': 'workspace_member',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='workspaceproject',
            index=models.Index(fields=['workspace'], name='workspace_pr_workspa_7c9c5e_idx'),
        ),
        migrations.AddIndex(
            model_name='workspaceproject',
            index=models.Index(fields=['project'], name='workspace_pr_project_2a3e8b_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='workspaceproject',
            unique_together={('workspace', 'project')},
        ),
        migrations.AddIndex(
            model_name='workspacemember',
            index=models.Index(fields=['workspace', 'enabled'], name='workspace_me_workspa_5e8f3c_idx'),
        ),
        migrations.AddIndex(
            model_name='workspacemember',
            index=models.Index(fields=['user', 'enabled'], name='workspace_me_user_id_4a2b1d_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='workspacemember',
            unique_together={('user', 'workspace')},
        ),
        migrations.AddIndex(
            model_name='workspace',
            index=models.Index(fields=['organization', 'deleted_at'], name='workspace_organiz_3c4d2e_idx'),
        ),
        migrations.AddIndex(
            model_name='workspace',
            index=models.Index(fields=['title'], name='workspace_title_1a2b3c_idx'),
        ),
    ]
