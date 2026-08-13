Currently menu.py and cutscene.py use pygame.font.SysFont("consolas", ...)
as a placeholder — that's why the text looks like plain monospace right now
instead of a "real" horror-game font.

To use a real font file instead:
  1. Drop a .ttf/.otf in this folder, e.g. "vcr_osd_mono.ttf"
     (VCR OSD Mono is the classic FNAF-style font if you want that exact vibe)
  2. In src/menu.py, replace:
         self._font = pygame.font.SysFont("consolas", config.MENU_FONT_SIZE, bold=True)
     with:
         self._font = pygame.font.Font(
             os.path.join(config.FONT_DIR, "vcr_osd_mono.ttf"),
             config.MENU_FONT_SIZE,
         )
     (same swap for self._title_font, and for the font in cutscene.py)

Kept as a manual step rather than baked in because font licensing varies —
grab one you're actually allowed to redistribute/use.
