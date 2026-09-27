extends SceneTree

var bad = 0

func _init() -> void:
	quit(_run())

func _initialize() -> void:
	pass

func _run() -> int:
	var Rules = load("res://rules.gd")
	var rules = Rules.new()
	rules.fresh(1)
	var zones: Array = rules.zone_thresholds()
	var names: PackedStringArray = rules.ghost_names()
	print("cfg tile=%s view=%s time=%s lives=%s/%s pellet=%s rainbow=%s zones=%s,%s,%s ghosts=%s,%s,%s,%s" % [
		rules.tile_count(), rules.view_size(), rules.time_label(),
		rules.start_lives(), rules.max_lives(), rules.pellet_score(), rules.rainbow_score(),
		zones[0], zones[1], zones[2], names[0], names[1], names[2], names[3],
	])
	_movement(rules)
	_clock(rules)
	_forage(rules)
	_dig(rules)
	_prism(rules)
	_coat(rules)
	_zones(rules)
	_laws(rules)
	_lunge(rules)
	print("RESULT %s" % ("pass" if bad == 0 else "fail"))
	return 0 if bad == 0 else 1

func check(ok: bool, name: String, detail: String) -> void:
	if ok:
		print("ok %s %s" % [name, detail])
	else:
		bad += 1
		print("FAIL %s %s" % [name, detail])

func step1(rules) -> void:
	rules.update(rules.dt_for_one_step())

func _movement(rules) -> void:
	rules.fresh(1)
	check(rules.fence_count() > 0, "fences_open", str(rules.fence_count()))
	check(rules.queue_len() == 0, "queue_empty", str(rules.queue_len()))
	rules.queue_dir(Vector2i(-1, 0))
	check(rules.queue_len() == 0, "reject_reverse", str(rules.queue_len()))
	rules.queue_dir(Vector2i(0, -1))
	rules.queue_dir(Vector2i(1, 0))
	rules.queue_dir(Vector2i(0, 1))
	check(rules.queue_len() == 2, "queue_cap", str(rules.queue_len()))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(0, 10, Vector2i(-1, 0))
	rules.mode = "play"
	step1(rules)
	check(rules.head().x == rules.tile_count() - 1 and rules.head().y == 10, "wrap", str(rules.head()))
	check(rules.snake_length() == 3, "wrap_len", str(rules.snake_length()))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	var before_len = rules.snake_length()
	rules.set_pellet(11, 10, 1)
	step1(rules)
	check(rules.snake_length() == before_len + 1, "grow", str(rules.snake_length()))
	check(rules.score == rules.pellet_score(), "pellet_score", str(rules.score))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.set_wall(11, 10, 1)
	step1(rules)
	check(rules.lives == rules.start_lives() - 1, "opaque_life", str(rules.lives))
	check(rules.mode == "play", "opaque_mode", rules.mode)
	check(rules.invuln == rules.invuln_ms(), "opaque_invuln", str(rules.invuln))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.set_wall(11, 10, 2)
	step1(rules)
	check(rules.lives == rules.start_lives() - 1, "fence_life", str(rules.lives))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.lives = 1
	rules.set_wall(11, 10, 1)
	step1(rules)
	check(rules.mode == "over" and rules.over_reason == "OUT OF LIVES" and rules.lives == 0, "out_of_lives", rules.over_reason)

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.set_snake([
		Vector2i(5, 5), Vector2i(4, 5), Vector2i(4, 6), Vector2i(5, 6),
		Vector2i(6, 6), Vector2i(6, 5), Vector2i(6, 4),
	], Vector2i(1, 0))
	rules.mode = "play"
	var lives_before = rules.lives
	var head_before = rules.head()
	step1(rules)
	check(rules.mode == "play" and rules.over_reason == "", "self_survives", rules.mode)
	check(rules.lives == lives_before, "self_lives", str(rules.lives))
	check(rules.invuln == rules.self_invuln_ms(), "self_invuln", str(rules.invuln))
	check(rules.head() != head_before, "self_relocated", str(rules.head()))

func _clock(rules) -> void:
	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.hi = 0
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.set_pellet(11, 10, 1)
	step1(rules)
	var scored = rules.score
	rules.update(rules.time_left)
	check(rules.mode == "over" and rules.over_reason == "TIME UP", "time_up", rules.over_reason)
	check(rules.hi == scored and scored > 0, "hi_stored", str(rules.hi))
	var kept = rules.hi
	rules.fresh(1)
	check(rules.hi == kept, "hi_next_run", str(rules.hi))

	rules.mode = "play"
	var spot = rules.head()
	var left = rules.time_left
	rules.toggle_pause()
	rules.update(5000)
	check(rules.mode == "paused" and rules.head() == spot and rules.time_left == left, "pause", "%s %s" % [rules.head(), rules.time_left])

func _forage(rules) -> void:
	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	var goal = rules.forage_goal()
	while rules.eaten < goal:
		var h = rules.head()
		rules.set_pellet(rules.ring(h.x + rules.direction.x), rules.ring(h.y + rules.direction.y), 1)
		step1(rules)
	check(rules.lives == rules.start_lives() + 1, "forage_life", str(rules.lives))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.lives = rules.max_lives()
	while rules.eaten < goal:
		var h2 = rules.head()
		rules.set_pellet(rules.ring(h2.x + rules.direction.x), rules.ring(h2.y + rules.direction.y), 1)
		step1(rules)
	var expect = goal * rules.pellet_score() + rules.bank_for(0)
	check(rules.lives == rules.max_lives() and rules.score == expect, "forage_bank", "%s %s" % [rules.lives, rules.score])

func _dig(rules) -> void:
	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.set_wall(13, 10, 1)
	var ghost = rules.place_ghost(rules.ghost_names()[1], 13, 10, false)
	var lives_before = rules.lives
	var dug: bool = rules.dig()
	check(dug, "dig_ok", str(dug))
	check(rules.head() == Vector2i(10 + rules.dash_tiles(), 10), "dig_land", str(rules.head()))
	check(rules.lives == lives_before and ghost.active, "dig_ignores_ghost", "%s %s" % [rules.lives, ghost.active])
	check(rules.dig_cool == rules.dash_cool_ms(), "dig_cool", str(rules.dig_cool))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.place_ghost(rules.ghost_names()[1], 11, 10, false)
	step1(rules)
	check(rules.lives == rules.start_lives() - 1, "surface_bump", str(rules.lives))

func _prism(rules) -> void:
	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(20, 20, Vector2i(1, 0))
	rules.mode = "play"
	var immune = rules.place_ghost(rules.ghost_names()[0], 40, 40, true)
	var prey = rules.place_ghost(rules.ghost_names()[1], 50, 40, false)
	rules.set_pellet(21, 20, 2)
	step1(rules)
	check(rules.score == rules.rainbow_score() and rules.prism > 0.0, "rainbow", str(rules.score))
	check(prey.state == "daze" and immune.state != "daze", "daze_split", "%s %s" % [prey.state, immune.state])
	var expect = rules.ghost_base()
	var doubles = 0
	for _i in 5:
		var h = rules.head()
		prey.active = true
		prey.immune = false
		prey.state = "daze"
		prey.x = rules.ring(h.x + rules.direction.x)
		prey.y = rules.ring(h.y + rules.direction.y)
		var before = rules.score
		step1(rules)
		check(rules.score - before == expect, "chain_%s" % _i, str(rules.score - before))
		if doubles < rules.chain_cap():
			expect *= 2
			doubles += 1
	var h2 = rules.head()
	immune.active = true
	immune.state = "daze"
	immune.x = rules.ring(h2.x + rules.direction.x)
	immune.y = rules.ring(h2.y + rules.direction.y)
	var untouched = rules.score
	step1(rules)
	check(rules.score == untouched and immune.active, "immune_uneaten", str(immune.active))

func _coat(rules) -> void:
	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.turncoat()
	var hunter = rules.place_ghost(rules.ghost_names()[1], 11, 10, false)
	var lives_before = rules.lives
	step1(rules)
	check(rules.lives == lives_before and hunter.traitor > 0 and hunter.traitor <= rules.traitor_ms(), "traitor", str(hunter.traitor))

	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	rules.turncoat()
	var armored = rules.place_ghost(rules.ghost_names()[0], 11, 10, true)
	lives_before = rules.lives
	step1(rules)
	check(rules.lives == lives_before and not rules.disguised and rules.coat_cool == rules.busted_cool_ms(), "bust", str(rules.coat_cool))
	check(armored.active, "bust_ghost", str(armored.active))

func _zones(rules) -> void:
	rules.fresh(1)
	rules.clear_ghosts()
	var fences = rules.fence_count()
	check(fences > 0 and rules.stage == 0, "zone_start", str(fences))
	rules.place(10, 10, Vector2i(1, 0))
	rules.mode = "play"
	var at: Array = rules.zone_thresholds()
	var guard = 0
	while rules.eaten < int(at[2]) and guard < 120:
		guard += 1
		var h = rules.head()
		rules.set_pellet(rules.ring(h.x + rules.direction.x), rules.ring(h.y + rules.direction.y), 1)
		var eaten_before = rules.eaten
		step1(rules)
		if rules.eaten == int(at[0]):
			check(rules.stage == 1, "zone_15", str(rules.stage))
		elif rules.eaten == int(at[1]):
			check(rules.stage == 2, "zone_40", str(rules.stage))
		if rules.eaten == eaten_before:
			check(false, "zone_stuck", str(rules.head()))
			return
	check(rules.eaten >= int(at[2]) and rules.stage == 3, "zone_last", "%s %s" % [rules.eaten, rules.stage])
	check(rules.fence_count() == 0, "fences_down", str(rules.fence_count()))

func _laws(rules) -> void:
	rules.fresh(1)
	var names: PackedStringArray = rules.ghost_names()
	rules.set_kinematics(10.0, 20.0, 0.2, 0.0, 0.5, 0.0, [Vector2(8, 20), Vector2(9, 20), Vector2(10, 20)])
	var blinky: Vector2i = rules.law_cell(names[0])
	var pinky: Vector2i = rules.law_cell(names[1])
	var inky: Vector2i = rules.law_cell(names[2])
	var clyde: Vector2i = rules.law_cell(names[3])
	check(blinky == Vector2i(10, 20), "blinky", str(blinky))
	check(pinky == Vector2i(11, 20), "pinky", str(pinky))
	check(inky == Vector2i(16, 20), "inky", str(inky))
	check(clyde == Vector2i(9, 20), "clyde", str(clyde))

func _arm_lunge(rules):
	rules.fresh(1)
	rules.clear_ghosts()
	rules.clear_walls()
	rules.place(20, 20, Vector2i(0, -1))
	rules.mode = "play"
	var g = rules.place_ghost(rules.ghost_names()[0], 19, 20, true)
	rules.enter_state(g, "aim")
	g.t = int(g.aim_ms - g.lock_ms) - 1
	rules.update(2)
	check(g.locked, "locked", str(g.locked))
	var frozen: Vector2i = g.target
	rules.update(2)
	check(g.locked and g.target == frozen, "lock_holds", str(g.target))
	g.t = int(g.aim_ms) - 1
	rules.update(2)
	check(g.state == "lunge" and g.target == Vector2i(20, 20), "lunge_line", "%s %s" % [g.state, g.target])
	return g

func _lunge(rules) -> void:
	var g = _arm_lunge(rules)
	var lives_before = rules.lives
	rules.update(int(ceil(rules.lunge_step_ms())))
	check(rules.lives == lives_before - 1, "lunge_life", str(rules.lives))

	_arm_lunge(rules)
	rules.invuln = rules.invuln_ms()
	lives_before = rules.lives
	rules.update(int(ceil(rules.lunge_step_ms())))
	check(rules.lives == lives_before, "lunge_invuln", str(rules.lives))

	_arm_lunge(rules)
	rules.turncoat()
	lives_before = rules.lives
	rules.update(int(ceil(rules.lunge_step_ms())))
	check(rules.lives == lives_before and rules.disguised, "lunge_disguise", str(rules.lives))

	_arm_lunge(rules)
	rules.set_head_under(true)
	lives_before = rules.lives
	rules.update(int(ceil(rules.lunge_step_ms())))
	check(rules.lives == lives_before, "lunge_under", str(rules.lives))
