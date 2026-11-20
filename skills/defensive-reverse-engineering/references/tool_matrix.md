# Defensive analysis tool matrix

## Contents

- Selection rules
- Tools
- Training and governance

## Selection rules

Choose by file format, architecture, question, evidence needs, and isolation—not popularity. Prefer a second independent tool for consequential findings. Verify current LICENSE files before redistribution or commercial embedding; project licenses and bundled-component terms can change.

| Capability | Tools and official sources | Use and caveat |
|---|---|---|
| Interactive static/decompilation | Ghidra — https://github.com/NationalSecurityAgency/ghidra (Apache-2.0) | Broad disassembly/decompilation and headless analysis; validate decompiler output against disassembly/behavior |
| CLI/GUI alternate static | radare2 — https://github.com/radareorg/radare2 (LGPL-3.0); rizin — https://github.com/rizinorg/rizin (LGPL-3.0); Cutter — https://github.com/rizinorg/cutter (GPL-3.0) | Alternate analysis and scripting; record exact version and architecture support |
| Android/Java | JADX — https://github.com/skylot/jadx (Apache-2.0); Apktool — https://github.com/iBotPeaches/Apktool (Apache-2.0) | DEX decompilation and APK resource/smali inspection; do not use for piracy |
| Windows debugging | x64dbg — https://github.com/x64dbg/x64dbg (GPL-3.0) | Authorized dynamic user-mode debugging in an isolated VM |
| Dynamic instrumentation | Frida — https://github.com/frida/frida (wxWindows Library Licence 3.1) | Authorized instrumentation only; instrumentation changes the observed environment |
| Programmatic/symbolic analysis | angr — https://github.com/angr/angr (BSD-2-Clause); Z3 — https://github.com/Z3Prover/z3 (MIT) | CFG, symbolic execution, constraints; state explosion and environment modeling limit coverage |
| Disassembly/emulation primitives | Capstone — https://github.com/capstone-engine/capstone (BSD-3-Clause); Unicorn — https://github.com/unicorn-engine/unicorn (GPL-2.0 terms) | Building blocks; verify copyleft obligations before embedding |
| Capability/string triage | capa/FLOSS — https://github.com/mandiant/capa (Apache-2.0) | Fast capability evidence and obfuscated-string support; findings still need corroboration |
| Pattern detection | YARA — https://github.com/VirusTotal/yara (BSD-3-Clause) | Detection/correlation rules; test false positives and encrypted/packed content limits |
| Memory forensics | Volatility 3 — https://github.com/volatilityfoundation/volatility3 (Volatility Software License) | Analyze authorized memory captures; verify profile/symbol and acquisition quality |
| Network evidence | Wireshark — https://gitlab.com/wireshark/wireshark (GPL-2.0-or-later); mitmproxy — https://github.com/mitmproxy/mitmproxy (MIT) | Analyze lab captures/interception only within authorization; protect captured secrets/data |
| Mobile assessment | MobSF — https://github.com/MobSF/Mobile-Security-Framework-MobSF (GPL-3.0); OWASP MAS — https://mas.owasp.org (CC BY-SA documentation) | Automated mobile checks plus MASVS/MASTG/MASWE requirements and test guidance |
| Isolated analysis environments | REMnux — https://docs.remnux.org; FLARE-VM — https://github.com/mandiant/flare-vm (installer Apache-2.0) | Linux/Windows analysis environments; distribution bundles have component-specific licenses |
| Simulated network | FakeNet-NG — https://github.com/mandiant/flare-fakenet-ng (Apache-2.0); INetSim — https://www.inetsim.org/ | Keep all traffic inside the isolated lab; simulation is not evidence of real infrastructure intent |

## Training and governance

OpenSecurityTraining2 (https://p.ost2.fyi/) provides architecture/assembly/reverse-engineering courses. pwn.college (https://pwn.college/) provides structured hands-on security learning; follow its rules and do not publish prohibited solutions. OWASP MAS supplies mobile security verification and testing guidance. NIST CSF 2.0 (https://www.nist.gov/cyberframework) connects technical findings to Govern, Identify, Protect, Detect, Respond, and Recover outcomes.

Do not pin exact tool versions in reusable instructions without checking official release pages. Record the version actually used in each analysis report.
