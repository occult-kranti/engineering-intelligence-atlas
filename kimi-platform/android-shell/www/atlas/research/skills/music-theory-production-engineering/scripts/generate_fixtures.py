#!/usr/bin/env python3
"""generate_fixtures.py — deterministically (re)generate the skill's original fixtures.

Stdlib only; no external audio tools; no network. Regeneration is byte-for-byte
deterministic (fixed parameters, no wall-clock inputs except the fixed
PROVENANCE_DATE constant below). Fixtures are ORIGINAL works generated for this
skill — not excerpts of any existing composition or recording.

Outputs (all under ../fixtures relative to this script):
    species_counterpoint_exercise.musicxml  original 16-bar two-voice fixture
    melody_c_major.mid                      original SMF format-0 fixture
    sine_440_mono_16bit_8k.wav              0.25 s, 8000 Hz, 16-bit PCM mono
    dc_offset_8k.wav                        0.25 s sine + deliberate DC offset
    provenance.json                         rights/provenance register + SHA-256

Usage:
    python3 generate_fixtures.py            # write fixtures + provenance
    python3 generate_fixtures.py --verify   # check on-disk files match hashes
"""
import hashlib
import json
import math
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.normpath(os.path.join(HERE, "..", "fixtures"))
PROVENANCE_DATE = "2026-11-21"  # fixed generation baseline (re-generation reuses it)

# ---------------------------------------------------------------- MusicXML ---

# Original 16-measure fixture: cantus-firmus-style lower voice, counterpoint a
# diatonic third above (imperfect consonances only; no parallel perfects).
# A teaching/parse fixture — NOT a graded species exercise and NOT a
# historical source. Both voices whole notes in C major.
CANTUS = ["C4", "D4", "E4", "F4", "G4", "A4", "G4", "F4",
          "E4", "D4", "E4", "F4", "G4", "E4", "D4", "C4"]
COUNTERPOINT = ["E4", "F4", "G4", "A4", "B4", "C5", "B4", "A4",
                "G4", "F4", "G4", "A4", "B4", "G4", "F4", "E4"]

_STEP_ALTER = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def _note_xml(name, divisions=1):
    step, octave = name[0], int(name[1])
    return (
        "      <note>\n"
        "        <pitch>\n"
        f"          <step>{step}</step>\n"
        f"          <octave>{octave}</octave>\n"
        "        </pitch>\n"
        f"        <duration>{4 * divisions}</duration>\n"
        "        <type>whole</type>\n"
        "      </note>\n"
    )


def build_musicxml():
    parts = []
    for part_id, part_name, notes in (
        ("P1", "Counterpoint (upper, generated)", COUNTERPOINT),
        ("P2", "Cantus firmus (lower, generated)", CANTUS),
    ):
        measures = []
        for i, n in enumerate(notes, 1):
            inner = ""
            if i == 1:
                inner += (
                    "        <attributes>\n"
                    "          <divisions>1</divisions>\n"
                    "          <key><fifths>0</fifths></key>\n"
                    "          <time><beats>4</beats><beat-type>4</beat-type></time>\n"
                    "          <clef><sign>G</sign><line>2</line></clef>\n"
                    "        </attributes>\n"
                )
            inner += _note_xml(n)
            measures.append(f'      <measure number="{i}">\n{inner}      </measure>\n')
        parts.append(f'    <part id="{part_id}">\n' + "".join(measures) + "    </part>\n")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!-- ORIGINAL generated fixture for the music-theory-production-engineering skill.\n'
        '     Generated deterministically by scripts/generate_fixtures.py on baseline date\n'
        f'     {PROVENANCE_DATE}. Not an excerpt of any existing work. Rights: CC0-1.0 (see\n'
        '     fixtures/provenance.json). MusicXML 4.0 partwise structure; external XSD\n'
        '     validation intentionally NOT bundled. -->\n'
        '<score-partwise version="4.0">\n'
        "  <work><work-title>Generated two-voice counterpoint fixture (original)</work-title></work>\n"
        "  <identification>\n"
        '    <creator type="composer">music-theory-production-engineering skill fixture generator</creator>\n'
        "    <encoding>\n"
        f"      <encoding-date>{PROVENANCE_DATE}</encoding-date>\n"
        "      <software>scripts/generate_fixtures.py (stdlib, deterministic)</software>\n"
        "    </encoding>\n"
        "  </identification>\n"
        "  <part-list>\n"
        '    <score-part id="P1"><part-name>Counterpoint (upper, generated)</part-name></score-part>\n'
        '    <score-part id="P2"><part-name>Cantus firmus (lower, generated)</part-name></score-part>\n'
        "  </part-list>\n"
        + "".join(parts) +
        "</score-partwise>\n"
    )

# ------------------------------------------------------------------- MIDI ---

def _varlen(value):
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


def build_midi():
    """SMF format 0, 96 ticks/quarter, 120 BPM, original C-major arpeggio melody."""
    division = 96
    track = bytearray()
    track += _varlen(0) + b"\xff\x51\x03" + struct.pack(">I", 500000)[1:]  # tempo
    track += _varlen(0) + b"\xff\x58\x04\x04\x02\x18\x08"                  # 4/4
    notes = [60, 64, 67, 72, 76, 72, 67, 64]  # C4 E4 G4 C5 E5 C5 G4 E4 (original)
    for note in notes:
        track += _varlen(0) + bytes([0x90, note, 80])
        track += _varlen(division) + bytes([0x80, note, 0])
    track += _varlen(0) + b"\xff\x2f\x00"
    return (b"MThd" + struct.pack(">IHHH", 6, 0, 1, division)
            + b"MTrk" + struct.pack(">I", len(track)) + bytes(track))

# -------------------------------------------------------------------- WAV ---

def _pcm16(frames):
    return b"".join(struct.pack("<h", max(-32768, min(32767, int(round(x * 32767.0)))))
                    for x in frames)


def build_wav(sample_rate, seconds, freq, amp, dc=0.0):
    n = int(sample_rate * seconds)
    frames = [dc + amp * math.sin(2.0 * math.pi * freq * i / sample_rate) for i in range(n)]
    data = _pcm16(frames)
    byte_rate = sample_rate * 2
    return (b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
            + b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, byte_rate, 2, 16)
            + b"data" + struct.pack("<I", len(data)) + data)

# ------------------------------------------------------------- provenance ---

FILES = {
    "species_counterpoint_exercise.musicxml": (
        "Original 16-bar two-voice counterpoint-style fixture (whole notes, C major, "
        "imperfect consonances). Generated, not transcribed; not a graded exercise."),
    "melody_c_major.mid": (
        "Original 8-note C-major arpeggio melody as SMF format 0 (96 tpq, 120 BPM). "
        "MIDI note numbering convention: middle C = 60."),
    "sine_440_mono_16bit_8k.wav": (
        "Synthesized 440 Hz sine, 0.25 s, 8000 Hz, 16-bit PCM mono, amplitude 0.5 FS. "
        "Synthesis, not a recording of anything."),
    "dc_offset_8k.wav": (
        "Synthesized 220 Hz sine amplitude 0.2 FS plus deliberate +0.1 FS DC offset, "
        "0.25 s, 8000 Hz — negative/DC test fixture for wav_metrics.py."),
}


def sha256(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def build_all():
    return {
        "species_counterpoint_exercise.musicxml": build_musicxml().encode("utf-8"),
        "melody_c_major.mid": build_midi(),
        "sine_440_mono_16bit_8k.wav": build_wav(8000, 0.25, 440.0, 0.5),
        "dc_offset_8k.wav": build_wav(8000, 0.25, 220.0, 0.2, dc=0.1),
    }


def provenance_doc(hashes):
    return {
        "schema_version": "1.0",
        "rights_holder": "Skill author (generated artifacts); released CC0-1.0",
        "license": {"spdx": "CC0-1.0",
                    "url": "https://creativecommons.org/publicdomain/zero/1.0/"},
        "generator": "scripts/generate_fixtures.py (Python stdlib only, deterministic)",
        "generated": PROVENANCE_DATE,
        "ai_involvement": "Fixtures synthesized by a deterministic script; no external "
                          "model output, no third-party recordings or samples.",
        "note": "These fixtures are original generated artifacts. They are NOT "
                "recordings, NOT excerpts, and carry no sampling/persona rights issues. "
                "Re-run of the generator on the same parameters reproduces identical "
                "bytes; hashes below are the regression record.",
        "assets": [
            {"file": name, "description": desc, "sha256": hashes[name],
             "source": "generated in-repo", "retrieval_date": PROVENANCE_DATE,
             "permission_scope": "unrestricted (CC0-1.0)",
             "attribution": "not required (CC0); cite the skill if convenient",
             "alterations_allowed": True}
            for name, desc in FILES.items()
        ],
    }


def main(argv):
    blobs = build_all()
    os.makedirs(FIXTURES, exist_ok=True)
    if "--verify" in argv:
        prov_path = os.path.join(FIXTURES, "provenance.json")
        with open(prov_path, encoding="utf-8") as fh:
            recorded = {a["file"]: a["sha256"] for a in json.load(fh)["assets"]}
        ok = True
        for name, blob in sorted(blobs.items()):
            path = os.path.join(FIXTURES, name)
            on_disk = sha256(path) if os.path.exists(path) else None
            rebuilt = hashlib.sha256(blob).hexdigest()
            if on_disk != rebuilt or recorded.get(name) != rebuilt:
                print(f"MISMATCH {name}")
                ok = False
            else:
                print(f"ok       {name} sha256={rebuilt[:16]}…")
        print("fixture regeneration deterministic" if ok else "FIXTURE VERIFY FAILED")
        return 0 if ok else 1
    for name, blob in blobs.items():
        with open(os.path.join(FIXTURES, name), "wb") as fh:
            fh.write(blob)
    hashes = {n: hashlib.sha256(b).hexdigest() for n, b in blobs.items()}
    with open(os.path.join(FIXTURES, "provenance.json"), "w", encoding="utf-8") as fh:
        json.dump(provenance_doc(hashes), fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    for n, h in sorted(hashes.items()):
        print(f"wrote fixtures/{n} sha256={h[:16]}…")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
