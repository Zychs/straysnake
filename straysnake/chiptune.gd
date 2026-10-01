extends Node
# Snake-Man chiptune: one synth for the music and every sound effect.
# Sound is rendered on the fly into an AudioStreamGenerator, so the game ships no audio
# files. Envelopes and pitch glides are worked out once per BLOCK samples; the waveform
# per sample. The lead voices feed a dotted-eighth echo; everything else stays dry.

const RATE := 22050.0
const BLOCK := 32
const MASTER := 0.22
const MUSIC_GAIN := 0.55
const ECHO_SECONDS := 0.375
const ECHO_FEEDBACK := 0.18
const ECHO_WET := 0.14
const ECHO_LOWPASS := 0.55

enum Wave { PULSE, SQUARE, TRI, SAW, SINE, NOISE }
enum Env { DECAY, LEAD, BASS, HAT }

# Music event kinds, as music.gd writes them.
enum Part { LEAD, HARM, BASS, HAT, HAT_ACCENT }

class Voice:
	var wave := 0
	var env := 0
	var f0 := 440.0
	var f1 := 440.0
	var start := 0
	var end := 0
	var dur := 0.1
	var vol := 1.0
	var hold := 0.0
	var echo := false
	var music := false
	var phase := 0.0
	var prev_noise := 0.0

var muted := false

var _playback: AudioStreamGeneratorPlayback
var _clock := 0
var _voices: Array = []
# Dry mix in [0, n), echo send in [n, 2n).
var _mix := PackedFloat32Array()
var _echo := PackedFloat32Array()
var _echo_pos := 0
var _echo_lp := 0.0

var _song: Dictionary = {}
var _music_on := false
var _mi := 0
var _loop_base := 0
var _music_clock := 0


func _ready() -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = RATE
	gen.buffer_length = 0.1
	var player := AudioStreamPlayer.new()
	player.stream = gen
	add_child(player)
	player.play()
	_playback = player.get_stream_playback()
	_echo.resize(int(RATE * ECHO_SECONDS))
	_echo.fill(0.0)
	_fill()


func _process(_delta: float) -> void:
	_fill()


# One note: pitch glides from f0 to f1 over dur seconds, starting `at` seconds from now.
func tone(f0: float, f1: float = -1.0, dur: float = 0.08, wave: int = Wave.SQUARE, vol: float = 1.0, at: float = 0.0) -> void:
	if muted:
		return
	var v := Voice.new()
	v.wave = wave
	v.env = Env.DECAY
	v.f0 = f0
	v.f1 = f0 if f1 < 0.0 else f1
	v.dur = dur
	v.vol = vol
	v.start = _clock + int(at * RATE)
	v.end = v.start + int((dur + 0.02) * RATE)
	_voices.append(v)


func arp(notes: Array, step: float, wave: int = Wave.TRI, vol: float = 1.0, at: float = 0.0) -> void:
	for i in notes.size():
		tone(notes[i], notes[i], step * 1.1, wave, vol, at + i * step)


func play_music(song: Dictionary) -> void:
	_drop_music()
	_song = song
	_mi = 0
	_loop_base = 0
	_music_clock = 0
	_music_on = true


func pause_music() -> void:
	_music_on = false
	_drop_music()


func resume_music() -> void:
	if not _song.is_empty():
		_music_on = true


func stop_music() -> void:
	_music_on = false
	_song = {}
	_drop_music()


func _drop_music() -> void:
	var kept: Array = []
	for v in _voices:
		if not v.music:
			kept.append(v)
	_voices = kept


func _fill() -> void:
	if _playback == null:
		return
	var n := _playback.get_frames_available()
	if n <= 0:
		return
	_schedule(n)
	_mix.resize(n * 2)
	_mix.fill(0.0)
	var alive: Array = []
	for v in _voices:
		_render(v, n)
		if v.end > _clock + n:
			alive.append(v)
	_voices = alive
	var out := PackedVector2Array()
	out.resize(n)
	var gain := 0.0 if muted else MASTER
	var elen := _echo.size()
	for i in n:
		var send := _mix[n + i]
		_echo_lp += ECHO_LOWPASS * (_echo[_echo_pos] - _echo_lp)
		_echo[_echo_pos] = send + _echo_lp * ECHO_FEEDBACK
		_echo_pos = (_echo_pos + 1) % elen
		var s := clampf((_mix[i] + send + _echo_lp * ECHO_WET) * gain, -1.0, 1.0)
		out[i] = Vector2(s, s)
	_playback.push_buffer(out)
	_clock += n


# Start every music note that begins before the end of this buffer.
func _schedule(n: int) -> void:
	if not _music_on:
		return
	var starts: PackedInt32Array = _song["s"]
	var count := starts.size()
	while true:
		if _mi >= count:
			_mi = 0
			_loop_base += int(_song["len"])
		var at := _loop_base + starts[_mi]
		if at >= _music_clock + n:
			break
		_spawn_music(_mi, _clock + at - _music_clock)
		_mi += 1
	_music_clock += n


func _spawn_music(i: int, start: int) -> void:
	var v := Voice.new()
	v.music = true
	v.start = start
	v.f0 = _song["f"][i]
	v.f1 = v.f0
	v.dur = _song["d"][i]
	match int(_song["k"][i]):
		Part.LEAD:
			v.wave = Wave.PULSE
			v.env = Env.LEAD
			v.vol = 0.5
			v.hold = 0.34
			v.echo = true
		Part.HARM:
			v.wave = Wave.SQUARE
			v.env = Env.LEAD
			v.vol = 0.13
			v.hold = 0.09
			v.echo = true
		Part.BASS:
			v.wave = Wave.TRI
			v.env = Env.BASS
			v.vol = 0.85
		Part.HAT:
			v.wave = Wave.NOISE
			v.env = Env.HAT
			v.vol = 0.1
		_:
			v.wave = Wave.NOISE
			v.env = Env.HAT
			v.vol = 0.3
	v.end = v.start + int(_tail(v) * RATE)
	_voices.append(v)


func _tail(v: Voice) -> float:
	match v.env:
		Env.LEAD:
			return v.dur * 0.84 + 0.12
		Env.BASS:
			return v.dur + 0.1
		Env.HAT:
			return 0.05
	return v.dur + 0.02


func _env(v: Voice, t: float) -> float:
	match v.env:
		Env.LEAD:
			# Detached: quick attack, settle to hold, release at 84% of the note.
			if t < 0.006:
				return v.vol * t / 0.006
			var rel := v.dur * 0.84
			var g := v.hold + (v.vol - v.hold) * exp(-(minf(t, rel) - 0.006) / 0.06)
			if t > rel:
				g *= exp(-(t - rel) / 0.02)
			return g
		Env.BASS:
			if t < 0.004:
				return v.vol * t / 0.004
			var r := v.dur * 0.9
			return v.vol if t < r else v.vol * exp(-(t - r) / 0.02)
		Env.HAT:
			return v.vol * exp(log(0.001 / v.vol) * t / 0.04)
	return v.vol * exp(log(0.001 / v.vol) * minf(t / v.dur, 1.0))


func _render(v: Voice, n: int) -> void:
	var i := maxi(0, v.start - _clock)
	var stop := mini(n, v.end - _clock)
	var off := n if v.echo else 0
	var scale := MUSIC_GAIN if v.music else 1.0
	var ph := v.phase
	var prev := v.prev_noise
	while i < stop:
		var j := mini(stop, i + BLOCK)
		var t := float(_clock + i - v.start) / RATE
		var g := _env(v, t) * scale
		var f := v.f0 if v.f0 == v.f1 else v.f0 * pow(v.f1 / v.f0, minf(t / v.dur, 1.0))
		var inc := f / RATE
		match v.wave:
			Wave.PULSE:
				for k in range(i, j):
					ph += inc
					if ph >= 1.0:
						ph -= 1.0
					_mix[off + k] += (1.2 if ph < 0.25 else -0.4) * g
			Wave.SQUARE:
				for k in range(i, j):
					ph += inc
					if ph >= 1.0:
						ph -= 1.0
					_mix[off + k] += (1.0 if ph < 0.5 else -1.0) * g
			Wave.TRI:
				for k in range(i, j):
					ph += inc
					if ph >= 1.0:
						ph -= 1.0
					_mix[off + k] += (4.0 * absf(ph - 0.5) - 1.0) * g
			Wave.SAW:
				for k in range(i, j):
					ph += inc
					if ph >= 1.0:
						ph -= 1.0
					_mix[off + k] += (2.0 * ph - 1.0) * g
			Wave.SINE:
				for k in range(i, j):
					ph += inc
					if ph >= 1.0:
						ph -= 1.0
					_mix[off + k] += sin(TAU * ph) * g
			_:
				# White noise through a first difference: a crude highpass for hats.
				for k in range(i, j):
					var x := randf() * 2.0 - 1.0
					_mix[off + k] += (x - prev) * 0.5 * g
					prev = x
		i = j
	v.phase = ph
	v.prev_noise = prev
