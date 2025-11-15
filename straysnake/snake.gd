extends Node2D

const SQRT3 := 1.7320508076
const CELL_SIZE := 24.0
const MOVE_RATE_BASE := 1.0 / 6.0

var snake: Array[Vector2] = []
var move_timer := 0.0
var dir_index := 0

const DIRS := [
    Vector2(1.0, 0.0),
    Vector2(-0.5, SQRT3 * 0.5),
    Vector2(-0.5, -SQRT3 * 0.5),
]

@export var move_rate_scale := 1.0
@export var starting_length := 6
@export var show_debug_grid := true

func _ready() -> void:
    _reset_snake()
    update()

func _process(delta: float) -> void:
    _read_input()
    var interval := MOVE_RATE_BASE / max(move_rate_scale, 0.1)
    move_timer += delta
    while move_timer >= interval:
        move_timer -= interval
        _move_forward()
        update()

func _read_input() -> void:
    if Input.is_action_just_pressed("ui_left"):
        dir_index = (dir_index + 1) % DIRS.size()
    elif Input.is_action_just_pressed("ui_right"):
        dir_index = (dir_index - 1 + DIRS.size()) % DIRS.size()
    elif Input.is_action_just_pressed("ui_accept"):
        _grow()

func _reset_snake() -> void:
    snake.clear()
    dir_index = 0
    var length := clamp(starting_length, 3, 60)
    for i in range(length):
        snake.append(Vector2(-i, 0))

func _move_forward() -> void:
    if snake.is_empty():
        return
    var dir := DIRS[dir_index]
    snake.insert(0, snake[0] + dir)
    snake.pop_back()

func _grow() -> void:
    if snake.is_empty():
        return
    snake.append(snake[snake.size() - 1])
    update()

func _draw() -> void:
    if show_debug_grid:
        _draw_tri_grid()
    for i in snake.size():
        var t := float(i) / max(snake.size() - 1, 1)
        var pos := snake[i] * CELL_SIZE
        var color := Color(0.2 + 0.6 * (1.0 - t), 0.9 - 0.3 * t, 0.5 + 0.3 * t)
        draw_circle(pos, CELL_SIZE * (0.5 - 0.05 * t), color)
    if snake.size() > 0:
        var head := snake[0] * CELL_SIZE
        draw_line(head, head + DIRS[dir_index] * CELL_SIZE * 0.8, Color(1, 1, 1, 0.8), 2.0)

func _draw_tri_grid() -> void:
    var rect := get_viewport_rect()
    var start_x := rect.position.x - rect.size.x
    var end_x := rect.position.x + rect.size.x
    var start_y := rect.position.y - rect.size.y
    var end_y := rect.position.y + rect.size.y
    var horiz_step := CELL_SIZE

    for x in range(int(start_x / horiz_step) - 2, int(end_x / horiz_step) + 2):
        var x_pos := x * horiz_step
        draw_line(Vector2(x_pos, start_y), Vector2(x_pos, end_y), Color(0.2, 0.2, 0.25, 0.3))

    for x in range(int(start_x / horiz_step) - 2, int(end_x / horiz_step) + 4):
        var x_pos := x * horiz_step * 0.5
        draw_line(Vector2(x_pos, start_y), Vector2(x_pos + rect.size.y, end_y), Color(0.15, 0.15, 0.2, 0.2))
        draw_line(Vector2(x_pos, end_y), Vector2(x_pos + rect.size.y, start_y), Color(0.15, 0.15, 0.2, 0.2))
