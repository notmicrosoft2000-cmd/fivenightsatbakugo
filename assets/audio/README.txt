Drop your two audio files directly in this folder:

  cutscene.ogg   -> the 00:57 unskippable intro. Length MUST match
                     config.CUTSCENE_DURATION (57.0s) or the visuals will
                     finish before/after the audio does — update that
                     constant if you re-time the file.

  menu.ogg       -> looping music for the main menu. Loops forever
                     (pygame.mixer.music loops=-1) once the cutscene ends.

Echo on the cutscene:
  For real reverb/echo quality, bake it into cutscene.ogg yourself in
  Audacity (Effect > Reverb, or Effect > Echo) before dropping it here.
  The game ALSO applies a lightweight runtime "slap echo" on top
  (src/cutscene.py -> EchoPlayer) using delayed/decaying repeats on extra
  mixer channels, tunable via CUTSCENE_ECHO_* in config.py. If you already
  baked echo into the file, either turn CUTSCENE_ECHO_ENABLED = False in
  config.py, or leave it on for an even wetter, more disorienting sound —
  your call, it's a taste thing.

Nothing in this folder is committed/tracked as a real asset — it's just
where the game looks at runtime (see config.py -> CUTSCENE_AUDIO / MENU_AUDIO).
