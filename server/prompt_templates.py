"""
Шаблоны промптов для типичных категорий SFX.

Подобраны эмпирически — описательные английские промпты работают
со Stable Audio Open лучше всего. Длительность подсказывает модели
ожидаемый характер (короткое = транзиент, длинное = текстура).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Template:
    category: str
    variant: str
    template: str        # с placeholder {duration}
    typical_duration: float
    description: str


SFX_TEMPLATES: list[Template] = [
    # === SWOOSH ===
    Template("swoosh", "soft", "gentle soft whoosh sound effect, smooth air movement, clean studio recording, {duration}s", 0.5,
             "Мягкий плавный свуш — для лёгких UI-переходов и мелких движений."),
    Template("swoosh", "hard", "aggressive fast whoosh, sharp air cut, high energy, dynamic, {duration}s", 0.4,
             "Резкий жёсткий свуш — для динамичных движений в моушн-графике."),
    Template("swoosh", "metallic", "metallic swoosh, steel blade through air, sci-fi, high frequency presence, {duration}s", 0.5,
             "Металлический свуш — для tech / sci-fi контекста."),
    Template("swoosh", "organic", "organic natural whoosh, fabric or paper movement, dry, {duration}s", 0.6,
             "Органический свуш — ткань, бумага, природные движения."),
    Template("swoosh", "cinematic", "cinematic whoosh transition with low rumble tail, hollywood trailer style, {duration}s", 1.5,
             "Кинематографический свуш с хвостом — для тизеров и трейлеров."),

    # === IMPACT ===
    Template("impact", "hit", "solid impact hit, punch or slap, dry attack, {duration}s", 0.4,
             "Чистый удар — пунч или шлепок."),
    Template("impact", "slam", "heavy door slam, deep resonant thud, low end, {duration}s", 0.7,
             "Тяжёлый слэм с резонансом."),
    Template("impact", "crash", "glass crash shatter, breaking impact with debris, {duration}s", 1.0,
             "Битьё стекла с осколками."),
    Template("impact", "thud", "deep bass thud, low frequency impact, sub presence, {duration}s", 0.5,
             "Низкочастотный thud — для веса в моушне."),
    Template("impact", "boom", "cinematic boom, deep impact with rumble, trailer hit, {duration}s", 1.2,
             "Кинематографический бум — для логотипов и заставок."),

    # === TRANSITION ===
    Template("transition", "rise", "tension riser, building anticipation sweep upward, white noise filtered, {duration}s", 2.0,
             "Восходящий riser — нагнетание."),
    Template("transition", "fall", "downward sweep, falling energy, descending pitch, {duration}s", 1.5,
             "Нисходящий свип."),
    Template("transition", "swell", "smooth swell build, cinematic rise with reverb, {duration}s", 2.5,
             "Плавный свелл — мягкий приход."),
    Template("transition", "reverse", "reverse cymbal, backward sweep effect, ethereal, {duration}s", 1.5,
             "Реверсивный звук — для появлений и реверсов."),
    Template("transition", "drone", "dark atmospheric drone build, ominous, {duration}s", 3.0,
             "Тёмный дрон — атмосфера и нагнетание."),

    # === UI ===
    Template("ui", "click", "clean digital click, UI button press, crisp, short, {duration}s", 0.1,
             "Чистый клик — нажатие кнопки."),
    Template("ui", "hover", "soft subtle hover sound, gentle digital feedback, {duration}s", 0.15,
             "Мягкий ховер — наведение."),
    Template("ui", "notification", "pleasant notification chime, alert tone, friendly, {duration}s", 0.5,
             "Приятный нотификейшн."),
    Template("ui", "error", "error buzz, negative feedback sound, low pitch, {duration}s", 0.3,
             "Ошибка — баззер."),
    Template("ui", "success", "success chime, positive feedback, ascending notes, {duration}s", 0.4,
             "Успех — восходящие ноты."),

    # === AMBIENT ===
    Template("ambient", "room", "quiet room tone, subtle background ambience, indoor, {duration}s", 5.0,
             "Тон комнаты — фоновая тишина."),
    Template("ambient", "wind", "gentle wind, outdoor breeze ambience, soft, {duration}s", 5.0,
             "Лёгкий ветер."),
    Template("ambient", "hum", "electronic hum, machine drone ambience, steady, {duration}s", 4.0,
             "Электронный гул."),
    Template("ambient", "static", "soft white noise static, analog texture, {duration}s", 3.0,
             "Аналоговый шум-текстура."),
    Template("ambient", "city", "distant city ambience, urban traffic background, {duration}s", 5.0,
             "Городской фон."),

    # === POP ===
    Template("pop", "bubble", "bubble pop, liquid plop sound, wet, {duration}s", 0.2,
             "Пузырь / плоп."),
    Template("pop", "snap", "finger snap, quick percussive pop, dry, {duration}s", 0.15,
             "Щелчок пальцами."),
    Template("pop", "click_pop", "mouth click pop, organic percussive, {duration}s", 0.1,
             "Цок языком."),
    Template("pop", "balloon", "balloon pop burst, sudden, {duration}s", 0.2,
             "Лопнувший шарик."),
]


def find_template(category: str, variant: str) -> Template | None:
    for t in SFX_TEMPLATES:
        if t.category == category and t.variant == variant:
            return t
    return None


def render_template(template: Template, duration: float) -> str:
    """Подставить длительность в шаблон."""
    return template.template.format(duration=f"{duration:.2f}")


def all_categories() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for t in SFX_TEMPLATES:
        if t.category not in seen:
            seen.add(t.category)
            out.append(t.category)
    return out


def variants_for(category: str) -> list[str]:
    return [t.variant for t in SFX_TEMPLATES if t.category == category]


def iter_templates() -> Iterable[Template]:
    return iter(SFX_TEMPLATES)
