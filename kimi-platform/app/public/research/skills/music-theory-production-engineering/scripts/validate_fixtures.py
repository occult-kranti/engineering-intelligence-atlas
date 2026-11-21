#!/usr/bin/env python3
"""validate_fixtures.py — parse and validate the bundled fixtures (stdlib only).

Checks (offline, deterministic):
  1. MusicXML: well-formed XML; score-partwise root with version 4.0; every
     score-part id has a matching part; every measure has number, one note with
     pitch(step+octave), duration, type; both parts have 16 measures; the two
     voices' pitch sequences match the generator's documented note lists
     (lossless pitch/duration round-trip at the fixture level).
     HONEST LIMIT: this is structural + semantic consistency, NOT W3C MusicXML
     XSD schema validation (external artifact; see modern_labs.md M3).
  2. MIDI: SMF header (MThd, format 0/1, track count, division), MTrk chunk,
     event stream parses to end-of-track with running status handled; note
     on/off pairing; note numbers in 0..127.
  3. WAV: RIFF/WAVE container, fmt + data chunks, PCM format 1, 16-bit mono,
     declared sample rate, data length consistent with header.

Exit 0 if all pass, 1 otherwise. No network, no external audio execution.
"""
import json
import os
import struct
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.normpath(os.path.join(HERE, "..", "fixtures"))

EXPECTED = {
    "P1": ["E4", "F4", "G4", "A4", "B4", "C5", "B4", "A4",
           "G4", "F4", "G4", "A4", "B4", "G4", "F4", "E4"],
    "P2": ["C4", "D4", "E4", "F4", "G4", "A4", "G4", "F4",
           "E4", "D4", "E4", "F4", "G4", "E4", "D4", "C4"],
}

failures = []


def check(ok, label):
    print(("ok   " if ok else "FAIL ") + label)
    if not ok:
        failures.append(label)


def validate_musicxml():
    path = os.path.join(FIXTURES, "species_counterpoint_exercise.musicxml")
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        check(False, f"MusicXML well-formed ({e})")
        return
    check(root.tag == "score-partwise", "MusicXML root is score-partwise")
    check(root.get("version") == "4.0", "MusicXML version 4.0 declared")
    score_parts = {sp.get("id") for sp in root.iter("score-part")}
    parts = {p.get("id"): p for p in root.iter("part")}
    check(score_parts == set(parts), f"part-list matches parts ({sorted(parts)})")
    for pid, expected in EXPECTED.items():
        part = parts.get(pid)
        if part is None:
            check(False, f"part {pid} present")
            continue
        measures = part.findall("measure")
        check(len(measures) == 16, f"part {pid} has 16 measures")
        got = []
        durations_ok = True
        for m in measures:
            notes = m.findall("note")
            if len(notes) != 1:
                durations_ok = False
                continue
            n = notes[0]
            step = n.findtext("pitch/step")
            octave = n.findtext("pitch/octave")
            dur = n.findtext("duration")
            typ = n.findtext("type")
            if step is None or octave is None or dur != "4" or typ != "whole":
                durations_ok = False
            got.append(f"{step}{octave}")
        check(durations_ok, f"part {pid}: all notes whole notes with duration=4/divisions")
        check(got == expected, f"part {pid}: pitch sequence round-trips ({got[:4]}…)")


def _read_varlen(data, i):
    value = 0
    while True:
        b = data[i]
        i += 1
        value = (value << 7) | (b & 0x7F)
        if not b & 0x80:
            return value, i


def validate_midi():
    path = os.path.join(FIXTURES, "melody_c_major.mid")
    data = open(path, "rb").read()
    check(data[:4] == b"MThd", "MIDI MThd header")
    hlen, fmt, ntrk, div = struct.unpack(">IHHH", data[4:14])
    check(hlen == 6 and fmt in (0, 1) and ntrk >= 1 and 1 <= div <= 32767,
          f"MIDI header fields (format={fmt}, tracks={ntrk}, division={div} tpq)")
    check(data[14:18] == b"MTrk", "MIDI MTrk chunk present")
    tlen = struct.unpack(">I", data[18:22])[0]
    track = data[22:22 + tlen]
    check(len(track) == tlen, "MIDI track length consistent")
    i, status, on, offs, eot = 0, None, set(), 0, False
    parse_ok = True
    try:
        while i < len(track):
            delta, i = _read_varlen(track, i)
            b = track[i]
            if b & 0x80:
                status = b
                i += 1
            ev, channel = status & 0xF0, status & 0x0F
            if ev == 0x90 or ev == 0x80:
                note, vel = track[i], track[i + 1]
                i += 2
                if not 0 <= note <= 127:
                    parse_ok = False
                if ev == 0x90 and vel > 0:
                    on.add(note)
                else:
                    offs += 1
                    on.discard(note)
            elif ev in (0xA0, 0xB0, 0xE0):
                i += 2
            elif ev in (0xC0, 0xD0):
                i += 1
            elif status == 0xFF:
                mtype = track[i]
                mlen, j = _read_varlen(track, i + 1)
                i = j + mlen
                if mtype == 0x2F:
                    eot = True
                    break
            elif status in (0xF0, 0xF7):
                mlen, j = _read_varlen(track, i)
                i = j + mlen
            else:
                parse_ok = False
                break
    except (IndexError, struct.error):
        parse_ok = False
    check(parse_ok, "MIDI event stream parses with running status")
    check(eot, "MIDI end-of-track meta event present")
    check(not on, "MIDI all notes paired note-on/note-off")
    check(offs == 8, f"MIDI contains the 8 documented melody notes (offs={offs})")


def validate_wav(name, expect_rate=8000, expect_frames=2000):
    path = os.path.join(FIXTURES, name)
    data = open(path, "rb").read()
    check(data[:4] == b"RIFF" and data[8:12] == b"WAVE", f"{name}: RIFF/WAVE container")
    riff_len = struct.unpack("<I", data[4:8])[0]
    check(riff_len == len(data) - 8, f"{name}: RIFF length field consistent")
    check(data[12:16] == b"fmt ", f"{name}: fmt chunk present")
    (fmt_len, audio_fmt, channels, rate, byte_rate, block_align,
     bits) = struct.unpack("<IHHIIHH", data[16:36])
    check(audio_fmt == 1 and channels == 1 and bits == 16,
          f"{name}: PCM 16-bit mono (fmt={audio_fmt}, ch={channels}, bits={bits})")
    check(rate == expect_rate, f"{name}: sample rate {rate} == declared {expect_rate}")
    check(byte_rate == rate * block_align and block_align == channels * bits // 8,
          f"{name}: byte_rate/block_align consistent")
    check(data[36:40] == b"data", f"{name}: data chunk present")
    dlen = struct.unpack("<I", data[40:44])[0]
    check(dlen == len(data) - 44 and dlen // 2 == expect_frames,
          f"{name}: data length {dlen} matches {expect_frames} frames")


def validate_provenance():
    path = os.path.join(FIXTURES, "provenance.json")
    doc = json.load(open(path, encoding="utf-8"))
    files_on_disk = {f for f in os.listdir(FIXTURES) if f != "provenance.json"}
    listed = {a["file"] for a in doc["assets"]}
    check(listed == files_on_disk, f"provenance.json covers every fixture ({sorted(listed)})")
    check(doc["license"]["spdx"] == "CC0-1.0", "provenance license is CC0-1.0")
    for a in doc["assets"]:
        required = {"source", "retrieval_date", "permission_scope",
                    "attribution", "alterations_allowed", "sha256"}
        check(required <= set(a), f"provenance record for {a['file']} has required fields")


def main():
    validate_musicxml()
    validate_midi()
    validate_wav("sine_440_mono_16bit_8k.wav")
    validate_wav("dc_offset_8k.wav")
    validate_provenance()
    if failures:
        print(f"\nvalidate_fixtures FAILED ({len(failures)} failures)")
        return 1
    print("\nvalidate_fixtures passed (MusicXML + MIDI + WAV + provenance)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
