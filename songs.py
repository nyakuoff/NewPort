#!/usr/bin/env python3
"""Rebuild assets/medias/songs.json from the audio files in assets/medias/.
Run after adding/removing songs:  python3 songs.py
Name files "Title - Artist.mp3" so the player can show both."""
import json, pathlib
d = pathlib.Path(__file__).parent / "assets" / "medias"
ext = {".mp3", ".ogg", ".opus", ".wav", ".m4a", ".flac"}
files = sorted(p.name for p in d.iterdir() if p.suffix.lower() in ext)
(d / "songs.json").write_text(json.dumps(files, indent=1, ensure_ascii=False) + "\n")
print(len(files), "songs:", *files, sep="\n  ")
