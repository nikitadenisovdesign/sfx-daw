# SFX DAW — Server

Бэкенд на FastAPI + Stable Audio Open. Запускается на ПК с RTX 5090.

## Установка (Windows + RTX 5090)

```powershell
# 1. CUDA 12.8 — скачать с https://developer.nvidia.com/cuda-downloads
# 2. Python 3.11
winget install Python.Python.3.11

# 3. Виртуальное окружение
cd server
python -m venv venv
.\venv\Scripts\activate

# 4. PyTorch с CUDA 12.8 (обязательно для Blackwell / RTX 5090)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128

# 5. Остальные зависимости
pip install -r requirements.txt
```

## Конфигурация

```powershell
copy .env.example .env
# Отредактируй пути: SFX_OUTPUT_DIR и SFX_DB_PATH
```

## Запуск

```powershell
python server.py
```

Первый запуск скачает модель Stable Audio Open (~4GB) с HuggingFace.
Дальше она кэшируется. После загрузки сервер слушает на `http://0.0.0.0:8000`.

Узнай LAN-IP ПК:

```powershell
ipconfig | findstr IPv4
```

## Открыть порт в файрволле

```powershell
# PowerShell от админа:
New-NetFirewallRule -DisplayName "SFX DAW Server" -Direction Inbound -Port 8000 -Protocol TCP -Action Allow
```

## Проверка с другого компа

```bash
curl http://192.168.x.x:8000/health
# {"status":"ok","gpu":"NVIDIA GeForce RTX 5090",...}

curl -X POST http://192.168.x.x:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"soft cinematic whoosh","duration":1.0,"num_variations":4}'
```

## Эндпоинты

| Метод | Путь                          | Описание                              |
|-------|-------------------------------|---------------------------------------|
| GET   | `/health`                     | состояние сервера и GPU               |
| GET   | `/templates`                  | список встроенных шаблонов            |
| POST  | `/generate`                   | генерация по свободному промпту       |
| POST  | `/generate/template`          | генерация по категории + варианту     |
| GET   | `/audio/{filename}`           | отдать WAV                            |
| GET   | `/library`                    | библиотека (search, filter)           |
| POST  | `/library/{id}/favorite`      | избранное                             |
| POST  | `/library/{id}/tags`          | обновить теги                         |
| DELETE| `/library/{id}`               | удалить                               |

## Структура

```
server/
├── server.py              # FastAPI app — роуты
├── inference.py           # Обёртка над Stable Audio Open
├── audio_processing.py    # Normalize, fade, trim, save_wav
├── prompt_templates.py    # SFX-шаблоны по категориям
├── models.py              # Pydantic модели запросов/ответов
├── db.py                  # SQLite-кэш (sqlite3)
├── config.py              # Настройки (Pydantic-Settings + .env)
├── requirements.txt
├── .env.example
└── generated/             # Сгенерированные WAV (создаётся автоматически)
```

## Известные подводные камни

- **stable-audio-tools и PyTorch 2.7+** — следи за совместимостью версий
  einops/torchsde. Если упадёт на импорте, поставь `pip install einops==0.7.0`.
- **VRAM:** инференс ест ~4GB, но при долгих сессиях фрагментация может
  увеличить usage. Перезапуск сервера обнуляет.
- **Длительность > 10s + steps=100** на 5090 ≈ 5-8 секунд генерации. Если
  нужно быстрее — снижай `steps` до 50 (потеряешь чуть в качестве).
- **Лицензия:** Stable Audio Open идёт под Stability Community License.
  Для коммерции с выручкой > $1M/год нужен Enterprise-контракт.
