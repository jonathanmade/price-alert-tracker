# PriceRadar — arranque completo en local (PowerShell)
# Requiere: Doppler CLI instalado y configurado (doppler setup)

Write-Host "Iniciando PriceRadar con Doppler..." -ForegroundColor Cyan

# Django
Start-Process powershell -ArgumentList "-NoExit", "-Command", "doppler run -- python manage.py runserver"

# Celery worker
Start-Process powershell -ArgumentList "-NoExit", "-Command", "doppler run -- celery -A config worker -l info"

# Celery beat
Start-Process powershell -ArgumentList "-NoExit", "-Command", "doppler run -- celery -A config beat -l info"

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; doppler run -- npm run dev"

Write-Host "Todos los servicios iniciados." -ForegroundColor Green
