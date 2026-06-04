#!/usr/bin/env bash
# PriceRadar — arranque completo en local (Bash)
# Requiere: Doppler CLI instalado y configurado (doppler setup)

set -e

echo "Iniciando PriceRadar con Doppler..."

# Django
doppler run -- python manage.py runserver &

# Celery worker
doppler run -- celery -A config worker -l info &

# Celery beat
doppler run -- celery -A config beat -l info &

# Frontend
cd frontend && doppler run -- npm run dev &

echo "Todos los servicios iniciados. Ctrl+C para detener."
wait
