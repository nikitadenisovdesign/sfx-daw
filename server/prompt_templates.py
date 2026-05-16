"""
Prompt templates for typical SFX categories.

Curated empirically — descriptive English prompts work best with Stable
Audio Open. The `typical_duration` hint nudges the model toward the right
character (short = transient, long = texture).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Template:
    category: str
    variant: str
    template: str        # contains the placeholder {duration}
    typical_duration: float
    description: str


SFX_TEMPLATES: list[Template] = [
    # === SWOOSH ===
    Template("swoosh", "soft", "gentle soft whoosh sound effect, smooth air movement, clean studio recording, {duration}s", 0.5,
             "Gentle whoosh — good for light UI transitions and small movements."),
    Template("swoosh", "hard", "aggressive fast whoosh, sharp air cut, high energy, dynamic, {duration}s", 0.4,
             "Hard whoosh — for kinetic motion graphics."),
    Template("swoosh", "metallic", "metallic swoosh, steel blade through air, sci-fi, high frequency presence, {duration}s", 0.5,
             "Metallic swoosh — sci-fi / tech context."),
    Template("swoosh", "organic", "organic natural whoosh, fabric or paper movement, dry, {duration}s", 0.6,
             "Organic whoosh — fabric, paper, natural movement."),
    Template("swoosh", "cinematic", "cinematic whoosh transition with low rumble tail, hollywood trailer style, {duration}s", 1.5,
             "Trailer-style whoosh with a low tail."),
    Template("swoosh", "magic", "magical sparkle whoosh, fairy dust trail, shimmering high frequencies, {duration}s", 0.8,
             "Magical sparkle whoosh — fairy dust trail."),
    Template("swoosh", "water", "water whoosh, splash trail, liquid motion, {duration}s", 0.7,
             "Water whoosh — wet, fluid motion."),
    Template("swoosh", "fire", "fire whoosh, flame burst, hot air rush, crackling tail, {duration}s", 0.8,
             "Fire whoosh — flame burst with crackle."),
    Template("swoosh", "thick", "thick heavy whoosh with sub-bass body, slow motion impact incoming, {duration}s", 1.2,
             "Thick, weighty whoosh — pairs with big impacts."),

    # === IMPACT ===
    Template("impact", "hit", "solid impact hit, punch or slap, dry attack, {duration}s", 0.4,
             "Clean punch / slap."),
    Template("impact", "slam", "heavy door slam, deep resonant thud, low end, {duration}s", 0.7,
             "Heavy door slam with resonance."),
    Template("impact", "crash", "glass crash shatter, breaking impact with debris, {duration}s", 1.0,
             "Glass shatter with debris."),
    Template("impact", "thud", "deep bass thud, low frequency impact, sub presence, {duration}s", 0.5,
             "Low-frequency thud — adds weight to motion."),
    Template("impact", "boom", "cinematic boom, deep impact with rumble, trailer hit, {duration}s", 1.2,
             "Trailer boom — great for logo stings."),
    Template("impact", "wood", "wooden impact, heavy crate drop, dry hollow thud, {duration}s", 0.5,
             "Wooden crate impact — dry and hollow."),
    Template("impact", "metal", "metal clang, steel pipe hit, ringing resonance, {duration}s", 0.8,
             "Metal clang with ringing tail."),
    Template("impact", "stone", "stone slab impact, rocky thud, dusty debris, {duration}s", 0.7,
             "Stone slab landing with dust."),
    Template("impact", "punch", "fight punch hit, body impact, fleshy, cinematic, {duration}s", 0.4,
             "Fight punch — fleshy and cinematic."),
    Template("impact", "kick", "low kick drum impact, sub bass weight, percussive, {duration}s", 0.3,
             "Sub-heavy kick impact."),
    Template("impact", "trailer_hit", "massive trailer hit, low boom with metallic shimmer, hollywood blockbuster, {duration}s", 1.8,
             "Massive blockbuster hit."),

    # === TRANSITION ===
    Template("transition", "rise", "tension riser, building anticipation sweep upward, white noise filtered, {duration}s", 2.0,
             "Rising tension riser."),
    Template("transition", "fall", "downward sweep, falling energy, descending pitch, {duration}s", 1.5,
             "Downward sweep."),
    Template("transition", "swell", "smooth swell build, cinematic rise with reverb, {duration}s", 2.5,
             "Smooth cinematic swell."),
    Template("transition", "reverse", "reverse cymbal, backward sweep effect, ethereal, {duration}s", 1.5,
             "Reverse sweep — for reveals."),
    Template("transition", "drone", "dark atmospheric drone build, ominous, {duration}s", 3.0,
             "Dark drone — atmosphere and dread."),
    Template("transition", "tape_stop", "tape stop effect, pitch slowing down to silence, vintage analog, {duration}s", 1.0,
             "Tape stop — analog slowdown."),
    Template("transition", "vinyl_scratch", "vinyl record scratch, dj turntable transition, {duration}s", 0.5,
             "Vinyl scratch transition."),
    Template("transition", "sparkle", "sparkle transition, glittery high frequencies, magical reveal, {duration}s", 1.2,
             "Sparkle — magical reveal."),
    Template("transition", "rewind", "fast rewind sweep, backward time travel effect, {duration}s", 1.0,
             "Fast rewind sweep."),
    Template("transition", "whoosh_riser", "long cinematic whoosh riser into impact, trailer ramp up, {duration}s", 3.0,
             "Long whoosh riser into impact."),

    # === UI ===
    Template("ui", "click", "clean digital click, UI button press, crisp, short, {duration}s", 0.1,
             "Clean digital click."),
    Template("ui", "hover", "soft subtle hover sound, gentle digital feedback, {duration}s", 0.15,
             "Subtle hover blip."),
    Template("ui", "notification", "pleasant notification chime, alert tone, friendly, {duration}s", 0.5,
             "Pleasant notification chime."),
    Template("ui", "error", "error buzz, negative feedback sound, low pitch, {duration}s", 0.3,
             "Error buzz."),
    Template("ui", "success", "success chime, positive feedback, ascending notes, {duration}s", 0.4,
             "Success chime — ascending notes."),
    Template("ui", "toggle", "toggle switch click, on/off feedback, mechanical, {duration}s", 0.15,
             "Mechanical toggle click."),
    Template("ui", "open", "panel opening sound, soft digital slide, {duration}s", 0.3,
             "Panel opening blip."),
    Template("ui", "close", "panel closing sound, gentle digital slide down, {duration}s", 0.3,
             "Panel closing blip."),
    Template("ui", "swipe", "swipe gesture sound, quick airy motion, {duration}s", 0.25,
             "Swipe gesture sound."),
    Template("ui", "scan", "scanning beep, digital readout sweep, sci-fi interface, {duration}s", 0.6,
             "Scanning beep — sci-fi interface."),
    Template("ui", "type", "mechanical keyboard typing, single keystroke, crisp, {duration}s", 0.1,
             "Single mechanical keystroke."),
    Template("ui", "denied", "access denied tone, harsh buzzer, negative, {duration}s", 0.4,
             "Access denied buzzer."),
    Template("ui", "level_up", "level up jingle, video game achievement, sparkle ascending, {duration}s", 1.0,
             "Game level-up jingle."),
    Template("ui", "coin", "coin pickup, retro game collect sound, bright bell, {duration}s", 0.2,
             "Retro coin pickup."),
    Template("ui", "message", "incoming message pop, soft bubble notification, {duration}s", 0.25,
             "Incoming message pop."),

    # === AMBIENT ===
    Template("ambient", "room", "quiet room tone, subtle background ambience, indoor, {duration}s", 5.0,
             "Quiet room tone."),
    Template("ambient", "wind", "gentle wind, outdoor breeze ambience, soft, {duration}s", 5.0,
             "Gentle outdoor breeze."),
    Template("ambient", "hum", "electronic hum, machine drone ambience, steady, {duration}s", 4.0,
             "Electronic machine hum."),
    Template("ambient", "static", "soft white noise static, analog texture, {duration}s", 3.0,
             "Analog static noise."),
    Template("ambient", "city", "distant city ambience, urban traffic background, {duration}s", 5.0,
             "Distant city traffic."),
    Template("ambient", "rain", "steady gentle rain on rooftop, soft patter, atmospheric, {duration}s", 6.0,
             "Rain on a rooftop."),
    Template("ambient", "forest", "deep forest ambience, distant birds, leaves rustling, peaceful, {duration}s", 6.0,
             "Deep forest with birds."),
    Template("ambient", "ocean", "ocean waves on beach, rolling surf, calm, {duration}s", 6.0,
             "Ocean waves on a beach."),
    Template("ambient", "fireplace", "crackling fireplace, wood burning, cozy indoor, {duration}s", 5.0,
             "Crackling fireplace."),
    Template("ambient", "cafe", "busy cafe background, distant chatter, espresso machine, {duration}s", 6.0,
             "Busy cafe with chatter."),
    Template("ambient", "subway", "subway tunnel ambience, distant train rumble, echoing footsteps, {duration}s", 6.0,
             "Subway tunnel ambience."),
    Template("ambient", "server_room", "data center ambience, server fans whirring, electronic hum, {duration}s", 5.0,
             "Server room hum."),
    Template("ambient", "library", "quiet library ambience, pages turning, distant whispers, {duration}s", 6.0,
             "Quiet library."),
    Template("ambient", "thunder", "distant thunderstorm rumble, rain in background, ominous, {duration}s", 6.0,
             "Distant thunderstorm rumble."),
    Template("ambient", "underwater", "underwater ambience, muffled bubbles, deep submerged tone, {duration}s", 5.0,
             "Underwater muffled bubbles."),

    # === POP ===
    Template("pop", "bubble", "bubble pop, liquid plop sound, wet, {duration}s", 0.2,
             "Bubble plop."),
    Template("pop", "snap", "finger snap, quick percussive pop, dry, {duration}s", 0.15,
             "Finger snap."),
    Template("pop", "click_pop", "mouth click pop, organic percussive, {duration}s", 0.1,
             "Mouth click."),
    Template("pop", "balloon", "balloon pop burst, sudden, {duration}s", 0.2,
             "Balloon burst."),
    Template("pop", "cork", "champagne cork pop, festive, sparkling release, {duration}s", 0.3,
             "Champagne cork."),
    Template("pop", "water_drip", "single water drop in pool, resonant plip, {duration}s", 0.25,
             "Single water drop."),
    Template("pop", "glass_tap", "fingernail tap on wine glass, ringing ping, {duration}s", 0.3,
             "Fingernail tap on glass."),

    # === EXPLOSION ===
    Template("explosion", "boom_big", "massive cinematic explosion, deep boom with debris fallout, {duration}s", 2.5,
             "Massive cinematic explosion."),
    Template("explosion", "boom_small", "small explosion pop, contained burst, dry, {duration}s", 0.6,
             "Small contained pop."),
    Template("explosion", "debris", "explosion debris fallout, rocks and shrapnel landing, {duration}s", 2.0,
             "Debris falling after a blast."),
    Template("explosion", "distant", "distant explosion rumble, far away boom, low frequency, {duration}s", 2.0,
             "Distant explosion rumble."),
    Template("explosion", "underwater", "underwater explosion, muffled blast with bubble release, {duration}s", 1.8,
             "Underwater muffled blast."),
    Template("explosion", "shockwave", "explosion shockwave, pressure pulse expanding outward, {duration}s", 1.5,
             "Expanding shockwave pulse."),

    # === FIRE ===
    Template("fire", "ignite", "fire ignition whoosh, gas flame catching, {duration}s", 0.7,
             "Gas flame catching."),
    Template("fire", "crackle", "fire crackling, wood burning embers, intimate, {duration}s", 3.0,
             "Wood crackling embers."),
    Template("fire", "roar", "raging fire roar, intense flames, hot wind, {duration}s", 2.5,
             "Raging fire roar."),
    Template("fire", "extinguish", "fire extinguish hiss, water on flames, steam release, {duration}s", 1.5,
             "Extinguishing hiss."),
    Template("fire", "torch", "torch ignite and burn loop, steady flame, fantasy, {duration}s", 3.0,
             "Burning torch flame."),
    Template("fire", "match", "match strike and ignite, small flame catching, {duration}s", 0.6,
             "Match strike."),

    # === WATER ===
    Template("water", "splash_small", "small water splash, single droplet impact, {duration}s", 0.5,
             "Small splash."),
    Template("water", "splash_big", "big water splash, body diving into pool, {duration}s", 1.0,
             "Big splash."),
    Template("water", "stream", "running water stream, brook flowing, peaceful, {duration}s", 4.0,
             "Running stream."),
    Template("water", "drip", "slow water drip into puddle, isolated, echoing, {duration}s", 1.5,
             "Slow drip into puddle."),
    Template("water", "pour", "water pouring into glass, steady stream, {duration}s", 2.0,
             "Pouring into a glass."),
    Template("water", "bubble_stream", "underwater bubble stream rising, continuous, {duration}s", 2.5,
             "Rising underwater bubbles."),

    # === MECHANICAL ===
    Template("mechanical", "gear", "metal gear turning, mechanical clockwork, {duration}s", 1.0,
             "Mechanical gear turn."),
    Template("mechanical", "lever", "heavy mechanical lever pull, metal ratchet click, {duration}s", 0.7,
             "Heavy lever pull."),
    Template("mechanical", "clank", "metal clank, machinery hit, industrial, {duration}s", 0.4,
             "Industrial metal clank."),
    Template("mechanical", "servo", "robotic servo motor, sci-fi articulation, {duration}s", 0.5,
             "Robot servo motor."),
    Template("mechanical", "steam", "steam pressure release, industrial hiss, {duration}s", 1.5,
             "Steam pressure release."),
    Template("mechanical", "engine_start", "engine cranking and starting up, mechanical, {duration}s", 2.5,
             "Engine cranking to start."),
    Template("mechanical", "winding", "clockwork mechanism winding up, gears tightening, {duration}s", 2.0,
             "Clockwork winding."),

    # === SCI-FI ===
    Template("sci-fi", "laser", "sci-fi laser blast, energy beam discharge, futuristic, {duration}s", 0.4,
             "Laser blast."),
    Template("sci-fi", "beam_charge", "energy weapon charging up, building power, sci-fi, {duration}s", 1.5,
             "Energy weapon charging."),
    Template("sci-fi", "scan", "alien scanner sweep, technological probing, {duration}s", 1.2,
             "Alien scanner sweep."),
    Template("sci-fi", "forcefield", "force field hum, energy shield vibration, sci-fi, {duration}s", 3.0,
             "Force field hum."),
    Template("sci-fi", "robot_voice", "robotic voice modulation, electronic tone, dystopian, {duration}s", 1.0,
             "Robotic voice modulation."),
    Template("sci-fi", "teleport", "teleport beam in, dematerialize effect, sparkly, {duration}s", 1.2,
             "Teleport materialize."),
    Template("sci-fi", "spaceship", "spaceship engine drone, deep mechanical hum, sci-fi cruise, {duration}s", 4.0,
             "Spaceship engine drone."),
    Template("sci-fi", "alarm", "spaceship red alert alarm, klaxon, danger, {duration}s", 1.5,
             "Spaceship klaxon."),

    # === HORROR ===
    Template("horror", "stinger", "horror stinger, sudden dissonant string hit, scary, {duration}s", 0.8,
             "Horror stinger string hit."),
    Template("horror", "drone", "horror drone, evil atmospheric pad, dread, {duration}s", 4.0,
             "Evil atmospheric drone."),
    Template("horror", "breath", "creepy heavy breathing, close microphone, unsettling, {duration}s", 2.0,
             "Creepy heavy breathing."),
    Template("horror", "scratch", "nails on chalkboard scratch, dissonant, painful, {duration}s", 1.0,
             "Nails on chalkboard."),
    Template("horror", "whisper", "ghostly whispers, eerie disembodied voices, {duration}s", 2.5,
             "Ghostly whispers."),
    Template("horror", "heartbeat", "slow ominous heartbeat, deep thumping, suspense, {duration}s", 3.0,
             "Slow ominous heartbeat."),

    # === NATURE ===
    Template("nature", "bird_song", "songbird chirping, single bird call, morning, {duration}s", 2.0,
             "Single songbird call."),
    Template("nature", "owl", "owl hoot at night, wise call, atmospheric, {duration}s", 1.5,
             "Owl hoot at night."),
    Template("nature", "wolf", "distant wolf howl, lonely, wilderness, {duration}s", 2.5,
             "Distant wolf howl."),
    Template("nature", "cricket", "cricket chirps, summer evening loop, {duration}s", 4.0,
             "Cricket chirps."),
    Template("nature", "thunderclap", "loud thunderclap with rumble tail, dramatic, {duration}s", 2.0,
             "Loud thunderclap."),
    Template("nature", "rain_heavy", "heavy rain downpour, intense storm, {duration}s", 5.0,
             "Heavy rain downpour."),
    Template("nature", "wind_strong", "strong wind gust, howling outdoor, {duration}s", 3.0,
             "Howling strong wind."),

    # === FOOTSTEPS ===
    Template("footsteps", "wood", "footsteps on wooden floor, single pair walking, hollow, {duration}s", 2.0,
             "Walking on wood."),
    Template("footsteps", "gravel", "footsteps on gravel path, crunchy, outdoor, {duration}s", 2.0,
             "Walking on gravel."),
    Template("footsteps", "snow", "footsteps in fresh snow, crunching, cold, {duration}s", 2.0,
             "Walking in snow."),
    Template("footsteps", "metal", "footsteps on metal grate, clanking, industrial, {duration}s", 2.0,
             "Walking on metal grate."),
    Template("footsteps", "grass", "footsteps on grass, soft outdoor walking, {duration}s", 2.0,
             "Walking on grass."),
    Template("footsteps", "water", "footsteps splashing through shallow water, wet, {duration}s", 2.0,
             "Walking through water."),
    Template("footsteps", "run", "fast running footsteps, urgent, dramatic, {duration}s", 2.0,
             "Fast running footsteps."),

    # === MUSICAL ===
    Template("musical", "orchestral_hit", "orchestral stab hit, brass and strings, dramatic, {duration}s", 0.6,
             "Orchestral stab — brass + strings."),
    Template("musical", "choir_swell", "choir vocal swell, ethereal voices rising, {duration}s", 3.0,
             "Choir vocal swell."),
    Template("musical", "piano_drone", "piano pedal drone, resonant low notes, atmospheric, {duration}s", 4.0,
             "Piano resonant drone."),
    Template("musical", "cymbal_crash", "orchestral cymbal crash, bright shimmer, {duration}s", 2.0,
             "Cymbal crash."),
    Template("musical", "harp_glissando", "harp glissando run, ascending magical sweep, {duration}s", 1.5,
             "Harp glissando."),
    Template("musical", "string_pluck", "single deep string pluck, cinematic bass, {duration}s", 1.0,
             "Deep cinematic string pluck."),

    # === VINTAGE ===
    Template("vintage", "vinyl_crackle", "vinyl record crackle and pop, nostalgic, lofi texture, {duration}s", 3.0,
             "Vinyl crackle texture."),
    Template("vintage", "film_projector", "old film projector clicking, mechanical reel, {duration}s", 3.0,
             "Film projector clicking."),
    Template("vintage", "radio_tune", "old radio tuning between stations, static and voices, {duration}s", 2.5,
             "Radio tuning between stations."),
    Template("vintage", "tape_hiss", "analog tape hiss texture, vintage recording noise, {duration}s", 3.0,
             "Analog tape hiss."),
    Template("vintage", "cassette_eject", "cassette tape eject, mechanical clunk, {duration}s", 0.5,
             "Cassette tape eject."),

    # === GLITCH ===
    Template("glitch", "digital", "digital glitch error, corrupted data burst, electronic, {duration}s", 0.4,
             "Digital glitch burst."),
    Template("glitch", "stutter", "audio stutter glitch, repeating digital fragment, {duration}s", 0.6,
             "Audio stutter."),
    Template("glitch", "bzzt", "electric bzzt zap, short circuit spark, {duration}s", 0.3,
             "Short-circuit bzzt."),
    Template("glitch", "data", "data transmission burst, modem handshake, fast digital, {duration}s", 1.0,
             "Modem-style data burst."),
    Template("glitch", "static_burst", "sudden static interference burst, harsh white noise spike, {duration}s", 0.5,
             "Sudden static spike."),
]


def find_template(category: str, variant: str) -> Template | None:
    for t in SFX_TEMPLATES:
        if t.category == category and t.variant == variant:
            return t
    return None


def render_template(template: Template, duration: float) -> str:
    """Substitute the duration into the template string."""
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
