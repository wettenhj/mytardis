# -*- coding: utf-8 -*-
# Generated by Django 1.11.16 on 2018-11-27 05:48
from __future__ import unicode_literals

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('tardis_portal', '0016_auto_20181127_1647'),
    ]

    operations = [
        migrations.AddField(
            model_name='facility',
            name='created_time',
            field=models.DateTimeField(blank=True, default=django.utils.timezone.now, null=True),
        ),
        migrations.AddField(
            model_name='facility',
            name='modified_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='instrument',
            name='created_time',
            field=models.DateTimeField(blank=True, default=django.utils.timezone.now, null=True),
        ),
        migrations.AddField(
            model_name='instrument',
            name='modified_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
