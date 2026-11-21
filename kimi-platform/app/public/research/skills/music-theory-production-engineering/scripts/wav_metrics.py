#!/usr/bin/env python3
"""wav_metrics.py — sample-domain QC metrics for PCM WAV files (stdlib only).

Computes, for 16-bit PCM mono WAV (the bundled fixture format):
    frames, duration, sample rate
    RMS level in dBFS
    sample peak in dBFS
    DC offset (mean sample value, in FS units and dBFS)

EXPLICIT LIMITS (do not overclaim from this output):
  * RMS dBFS is NOT integrated loudness. LUFS requires the full ITU-R BS.1770
    chain (K-weighting filter + absolute/relative gating), which is NOT
    implemented here.
  * Sample peak is NOT true-peak. True-peak (dBTP) requires oversampling per
    BS.1770, which is NOT implemented here.
  * Nothing here is a perceptual-quality judgment; see evaluation_and_rights.md
    for the listening-test standards (BS.1116-3, BS.1534-3) that would apply.

Usage:
    python3 wav_metrics.py fixtures/sine_440_mono_16bit_8k.wav
    python3 wav_metrics.py --self-test
"""
import math
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.normpath(os.path.join(HERE, "..", "fixtures"))


def read_pcm16_mono(path):
    data = open(path, "rb").read()
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("not a RIFF/WAVE file")
    fmt_len, audio_fmt, channels, rate, _br, _ba, bits = struct.unpack(
        "<IHHIIHH", data[16:36])
    if audio_fmt != 1 or channels != 1 or bits != 16:
        raise ValueError(f"unsupported format: fmt={audio_fmt} ch={channels} bits={bits} "
                         "(this tool handles PCM 16-bit mono only)")
    dlen = struct.unpack("<I", data[40:44])[0]
    frames = struct.unpack(f"<{dlen // 2}h", data[44:44 + dlen])
    return rate, frames


def metrics(path):
    rate, frames = read_pcm16_mono(path)
    n = len(frames)
    fs = [x / 32768.0 for x in frames]
    mean_sq = sum(x * x for x in fs) / n
    mean = sum(fs) / n
    peak = max(abs(x) for x in fs)
    db = lambda v: -math.inf if v <= 0 else 20.0 * math.log10(v)
    return {
        "file": os.path.basename(path),
        "sample_rate": rate,
        "frames": n,
        "duration_s": round(n / rate, 6),
        "rms_dbfs": round(db(math.sqrt(mean_sq)), 3),
        "sample_peak_dbfs": round(db(peak), 3),
        "dc_offset_fs": round(mean, 6),
        "dc_offset_dbfs": round(db(abs(mean)), 3),
        "not_implemented": ["LUFS (BS.1770 integrated loudness)",
                            "true-peak (dBTP, BS.1770 oversampled)"],
    }


def self_test():
    """Analytic checks on the two bundled fixtures (tolerance 0.05 dB)."""
    fails = []
    sine = metrics(os.path.join(FIXTURES, "sine_440_mono_16bit_8k.wav"))
    # 440 Hz sine, amplitude 0.5 FS: RMS = amp/sqrt(2) -> -9.03 dBFS; peak -> -6.02 dBFS
    if abs(sine["rms_dbfs"] - (-9.031)) > 0.05:
        fails.append(f"sine RMS {sine['rms_dbfs']} != -9.031 dBFS")
    if abs(sine["sample_peak_dbfs"] - (-6.021)) > 0.05:
        fails.append(f"sine peak {sine['sample_peak_dbfs']} != -6.021 dBFS")
    if abs(sine["dc_offset_fs"]) > 0.001:
        fails.append(f"sine DC {sine['dc_offset_fs']} != ~0")
    dcfx = metrics(os.path.join(FIXTURES, "dc_offset_8k.wav"))
    if abs(dcfx["dc_offset_fs"] - 0.1) > 0.002:
        fails.append(f"DC fixture offset {dcfx['dc_offset_fs']} != ~0.1 FS")
    if not (dcfx["sample_peak_dbfs"] < 0.0):
        fails.append("DC fixture peak should stay under 0 dBFS")
    for m in (sine, dcfx):
        print(m)
    if fails:
        print("SELF-TEST FAILED:")
        for f in fails:
            print("  " + f)
        return 1
    print("self-test passed (analytic RMS/peak/DC values within 0.05 dB)")
    return 0


def main(argv):
    if "--self-test" in argv:
        return self_test()
    args = [a for a in argv if not a.startswith("-")]
    if len(args) != 1:
        print(__doc__)
        return 2
    m = metrics(args[0])
    for k, v in m.items():
        print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
