# SFX DAW

> AI-first браузерный DAW для генерации и наслоения звуковых эффектов поверх видео.
> Для моушн-дизайнеров и видео-продакшен студий.

## Архитектура

```
┌──────────────────────────────┐         ┌──────────────────────────────────────┐
│        client/ (Mac)          │         │           server/ (PC + RTX 5090)     │
│                                │         │                                       │
│   React 18 + Vite + TS         │   LAN   │   FastAPI + Stable Audio Open         │
│   Zustand + Web Audio API      │ ──────► │   PyTorch 2.7+ / CUDA 12.8            │
│   localhost:5173               │ ◄────── │   http://192.168.x.x:8000             │
└──────────────────────────────┘         └──────────────────────────────────────┘
```

## Quick start

### 1. Backend (на ПК с RTX 5090, Windows)

```powershell
cd server
python -m venv venv
.\venv\Scripts\activate
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
python server.py
```

Сервер слушает на `http://0.0.0.0:8000`.
Узнай IP ПК через `ipconfig` (например `192.168.1.42`).

### 2. Frontend (на MacBook)

```bash
cd client
cp .env.example .env
# отредактируй .env: VITE_API_URL=http://192.168.1.42:8000
npm install
npm run dev
```

Открой `http://localhost:5173`.

### 3. Проверка связи

```bash
curl http://192.168.1.42:8000/health
# {"status":"ok","gpu":"NVIDIA GeForce RTX 5090","vram_total_gb":32.0,...}
```

Если не видно с мака — открой порт 8000 в Windows Firewall (см. `server/README.md`).

## Структура

```
sfx-daw/
├── client/                    # React frontend (см. client/README.md)
├── server/                    # FastAPI backend (см. server/README.md)
└── README.md
```

## MVP-фазы (из брифа)

- [x] Фаза 0: Скаффолд проекта
- [ ] Фаза 1: Окружение и инфраструктура (CUDA + PyTorch + загрузка модели)
- [ ] Фаза 2: AI-генерация SFX (шаблоны, вариации, кэш)
- [ ] Фаза 3: Видеоплеер + таймлайн
- [ ] Фаза 4: Звуковой движок + микшер
- [ ] Фаза 5: Библиотека + экспорт
- [ ] Фаза 6: Тестирование + полировка

## Лицензия

Stable Audio Open идёт под Stability AI Community License — коммерческое
использование разрешено для компаний с выручкой < $1M/год. Выше — нужна
Enterprise-лицензия.
