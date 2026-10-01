extends RefCounted
# The Snake-Man suite: v1 then v2, 32 bars at 120 BPM, about 64 s, looping.
# A minor and C major, half each; each version runs A, B, A', B'.
# v1 keeps its styles in turns (Mozart turns and Alberti bass, then Pac-Man octave bass).
# v2 blends them in every bar (Tetris long-short-short rhythm, turns and chromatic climbs,
# Alberti bass that jumps an octave on beat 3, a quiet second voice in thirds).
# A bar is 16 sixteenths. A lead is "NOTE:len ..."; a bass is [[chord, len], ...].
# build() turns the score into the arrays chiptune.gd plays.

const BPM := 120.0

const SEMI := {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
const LETTERS := ["C", "D", "E", "F", "G", "A", "B"]
const CHORD := {
	"Am": ["A2", "C3", "E3"],
	"E": ["E2", "G#2", "B2"],
	"Dm": ["D2", "F2", "A2"],
	"Dm/F": ["F2", "A2", "D3"],
	"C": ["C2", "E2", "G2"],
	"G7": ["G2", "B2", "F3"],
	"F": ["F2", "A2", "C3"],
}

# [lead, bass, bass style]
const V1 := {
	1: ["B4:1 A4:1 G#4:1 A4:1 C5:4 D5:1 C5:1 B4:1 C5:1 E5:4", [["Am", 16]], "alberti"],
	2: ["F5:1 E5:1 D#5:1 E5:1 B5:2 A5:2 G#5:4 E5:4", [["E", 16]], "alberti"],
	3: ["A5:2 E5:2 C5:2 A4:2 D5:3 C5:1 B4:2 A4:2", [["Am", 8], ["Dm/F", 8]], "alberti"],
	4: ["G#4:2 B4:2 E5:2 D5:2 C5:2 B4:2 A4:4", [["E", 8], ["Am", 8]], "alberti"],
	5: ["D5:1 C#5:1 D5:1 F5:1 A5:2 F5:2 D5:2 F5:2 E5:2 D5:2", [["Dm", 16]], "alberti"],
	6: ["C5:1 B4:1 C5:1 E5:1 A5:4 G5:2 F5:2 E5:4", [["Am", 16]], "alberti"],
	7: ["F5:2 D5:2 B4:2 G#4:2 A4:1 B4:1 C5:1 D5:1 E5:4", [["E", 16]], "alberti"],
	8: ["A5:1 G#5:1 A5:1 B5:1 C6:2 B5:1 A5:1 G#5:2 E5:2 A5:4", [["E", 12], ["Am", 4]], "alberti"],
	9: ["E5:2 G5:2 C6:2 G5:2 E5:1 F5:1 G5:1 A5:1 G5:4", [["C", 16]], "octave"],
	10: ["F5:2 D5:2 B4:2 D5:2 G5:1 F5:1 E5:1 D5:1 C5:2 B4:2", [["G7", 16]], "octave"],
	11: ["C5:1 E5:1 G5:1 C6:1 E6:2 D6:2 C6:2 G5:2 E5:4", [["C", 16]], "octave"],
	12: ["D5:1 E5:1 F5:1 D5:1 B4:2 D5:2 E5:4 G#4:4", [["G7", 8], ["E", 8]], "octave"],
	13: ["A5:2 F5:2 C5:2 F5:2 A5:1 G5:1 F5:1 E5:1 F5:4", [["F", 16]], "octave"],
	14: ["E5:1 D5:1 C5:1 D5:1 E5:2 G5:2 C6:4 B5:2 G5:2", [["C", 8], ["G7", 8]], "octave"],
	15: ["F5:2 A5:2 D6:2 C6:2 B5:1 A5:1 G5:1 F5:1 E5:2 D5:2", [["Dm", 8], ["G7", 8]], "octave"],
	16: ["C5:1 E5:1 G5:1 C6:1 B5:1 C6:1 D6:1 B5:1 C6:8", [["C", 16]], "octave"],
}

const V2 := {
	1: ["A5:4 E5:2 F5:2 E5:4 D5:1 C5:1 B4:1 C5:1", [["Am", 16]]],
	2: ["B4:4 G#4:2 A4:2 B4:2 C5:1 C#5:1 D5:2 D#5:2", [["E", 16]]],
	3: ["E5:4 A5:2 G#5:2 A5:4 F5:2 D5:2", [["Am", 8], ["Dm/F", 8]]],
	4: ["B4:1 A4:1 G#4:1 A4:1 B4:2 E5:2 C5:1 B4:1 A4:1 G#4:1 A4:4", [["E", 8], ["Am", 8]]],
	5: ["D5:4 F5:2 E5:2 D5:2 C#5:1 D5:1 A5:4", [["Dm", 16]]],
	6: ["C5:4 E5:2 D5:2 C5:2 B4:1 C5:1 E5:4", [["Am", 16]]],
	7: ["F5:1 E5:1 D#5:1 E5:1 G#5:2 B5:2 D6:4 B5:2 G#5:2", [["E", 16]]],
	8: ["A5:4 E5:2 C5:2 B4:2 G#4:2 A4:4", [["Am", 4], ["E", 8], ["Am", 4]]],
	9: ["G5:4 E5:2 F5:2 G5:2 A5:1 A#5:1 B5:2 C6:2", [["C", 16]]],
	10: ["D6:4 B5:2 C6:2 B5:1 A5:1 G5:1 A5:1 G5:4", [["G7", 16]]],
	11: ["E6:4 C6:2 G5:2 A5:2 G5:1 F5:1 E5:4", [["C", 8], ["Am", 8]]],
	12: ["F5:4 D5:2 E5:2 F5:1 E5:1 D#5:1 E5:1 G#5:2 B4:2", [["Dm", 8], ["E", 8]]],
	13: ["C6:4 A5:2 F5:2 A5:2 G5:1 F5:1 C6:4", [["F", 16]]],
	14: ["E5:4 G5:2 F5:2 E5:1 D5:1 C5:1 D5:1 B4:4", [["C", 8], ["G7", 8]]],
	15: ["F5:4 A5:2 G5:2 F5:2 F#5:1 G5:1 D6:4", [["Dm", 8], ["G7", 8]]],
	16: ["E6:4 D6:2 B5:2 C6:1 B5:1 A5:1 B5:1 C6:4", [["C", 16]]],
}

const ORDER := [1, 2, 3, 4, 9, 10, 11, 12, 5, 6, 7, 8, 13, 14, 15, 16]

# chiptune.gd Part values
const LEAD := 0
const HARM := 1
const BASS := 2
const HAT := 3
const HAT_ACCENT := 4


static func hz(note: String) -> float:
	var pitch := note.substr(0, note.length() - 1)
	var octave := int(note.substr(note.length() - 1))
	var midi: int = (octave + 1) * 12 + int(SEMI[pitch])
	return 440.0 * pow(2.0, float(midi - 69) / 12.0)


# A diatonic third below, for v2's second voice. G becomes G# over E.
static func third_below(note: String, chord: String) -> String:
	var i := LETTERS.find(note.substr(0, 1)) - 2
	var octave := int(note.substr(note.length() - 1))
	if i < 0:
		i += 7
		octave -= 1
	var letter: String = LETTERS[i]
	var sharp := "#" if letter == "G" and chord == "E" else ""
	return letter + sharp + str(octave)


static func build(rate: float) -> Dictionary:
	var rows: Array = []
	var t0 := 0
	for n in ORDER:
		t0 = _bar(rows, V1[n], false, t0)
	for n in ORDER:
		t0 = _bar(rows, V2[n], true, t0)
	rows.sort_custom(func(a, b): return a[0] < b[0])
	var sixteenth := 60.0 / BPM / 4.0
	var starts := PackedInt32Array()
	var durs := PackedFloat32Array()
	var freqs := PackedFloat32Array()
	var kinds := PackedInt32Array()
	for r in rows:
		starts.append(int(round(float(r[0]) * sixteenth * rate)))
		durs.append(float(r[1]) * sixteenth)
		freqs.append(r[2])
		kinds.append(r[3])
	return {"s": starts, "d": durs, "f": freqs, "k": kinds, "len": int(round(t0 * sixteenth * rate))}


static func _chord_at(bass: Array, x: int) -> String:
	var t := 0
	for seg in bass:
		if x < t + int(seg[1]):
			return seg[0]
		t += int(seg[1])
	return bass[bass.size() - 1][0]


static func _bar(rows: Array, bar: Array, blend: bool, t0: int) -> int:
	var lead: String = bar[0]
	var bass: Array = bar[1]
	var t := 0
	for token in lead.split(" "):
		var parts := token.split(":")
		var len16 := int(parts[1])
		rows.append([t0 + t, len16, hz(parts[0]), LEAD])
		if blend and len16 >= 4:
			rows.append([t0 + t, len16, hz(third_below(parts[0], _chord_at(bass, t))), HARM])
		t += len16
	if blend:
		for k in 8:
			var c: Array = CHORD[_chord_at(bass, k * 2)]
			var lo := hz(c[0])
			var mid := hz(c[1])
			var hi := hz(c[2])
			var f: float = [lo, hi, mid, hi, lo * 2.0, hi, mid, hi][k]
			rows.append([t0 + k * 2, 2, f, BASS])
	else:
		var s := 0
		for seg in bass:
			var c: Array = CHORD[seg[0]]
			var lo := hz(c[0])
			var mid := hz(c[1])
			var hi := hz(c[2])
			var pattern: Array = [lo, hi, mid, hi] if bar[2] == "alberti" else [lo, lo * 2.0]
			for k in int(seg[1]) >> 1:
				rows.append([t0 + s + k * 2, 2, pattern[k % pattern.size()], BASS])
			s += int(seg[1])
	for k in range(0, 16, 2):
		rows.append([t0 + k, 1, 0.0, HAT_ACCENT if k == 4 or k == 12 else HAT])
	return t0 + 16
