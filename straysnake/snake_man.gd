extends Node2D

const RulesScript = preload("res://rules.gd")
const Chiptune = preload("res://chiptune.gd")
const Music = preload("res://music.gd")
const Sfx = preload("res://sfx.gd")
var rules = RulesScript.new()
var booted := false
var synth: Chiptune
var sfx: Sfx

func _ready() -> void:
	rules.fresh(1)
	synth = Chiptune.new()
	add_child(synth)
	sfx = Sfx.new(synth, Music.build(Chiptune.RATE))
	sfx.observe(rules)
	booted = true
	print(rules.boot_line())

func _process(delta: float) -> void:
	if not booted:
		return
	if rules.mode == "play":
		var ms := int(round(delta * 1000.0))
		if ms > 0:
			rules.update(ms)
	sfx.observe(rules)
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey):
		return
	var key := event as InputEventKey
	if not key.pressed or key.echo:
		return
	var d := Vector2i.ZERO
	match key.keycode:
		KEY_UP, KEY_W:
			d = Vector2i(0, -1)
		KEY_RIGHT, KEY_D:
			d = Vector2i(1, 0)
		KEY_DOWN, KEY_S:
			d = Vector2i(0, 1)
		KEY_LEFT, KEY_A:
			d = Vector2i(-1, 0)
		KEY_SHIFT:
			sfx.dug(rules.dig(), rules.mode)
			return
		KEY_ESCAPE:
			rules.turncoat()
			return
		KEY_SPACE:
			rules.toggle_pause()
			return
		KEY_V:
			synth.muted = not synth.muted
			return
	if d != Vector2i.ZERO:
		rules.queue_dir(d)

func _draw() -> void:
	if rules.snake.is_empty():
		return
	var cell := 6.0
	var origin := Vector2(8, 8)
	var n := rules.tile_count()
	for y in n:
		for x in n:
			var w := rules.wall_at(x, y)
			if w == 0:
				continue
			var col := Color(0.25, 0.35, 0.95) if w == 1 else Color(0.7, 0.3, 0.9)
			draw_rect(Rect2(origin + Vector2(x, y) * cell, Vector2(cell, cell)), col)
	for key in rules.pellets:
		var idx := int(key)
		var px := idx % n
		var py := int(idx / float(n))
		var kind := int(rules.pellets[key])
		var pellet_col := Color(1, 0.85, 0.2) if kind == 1 else Color(1, 1, 1)
		draw_rect(Rect2(origin + Vector2(px, py) * cell, Vector2(cell, cell)), pellet_col)
	for g in rules.ghosts:
		if not g.active:
			continue
		draw_rect(Rect2(origin + Vector2(g.x, g.y) * cell, Vector2(cell, cell)), Color(0.9, 0.2, 0.25))
	for i in rules.snake.size():
		var s: Vector3i = rules.snake[i]
		var snake_col := Color(0.85, 1, 0.4) if i == 0 else Color(0.2, 0.95, 0.35)
		draw_rect(Rect2(origin + Vector2(s.x, s.y) * cell, Vector2(cell, cell)), snake_col)
