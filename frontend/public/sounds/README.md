# Custom Sound Files

Place your sound files here. The game will automatically detect them.

## Buzzer sound (plays when a player hits the buzzer)
- `buzzer.mp3`  ← recommended
- `buzzer.wav`

## Timer end sound (plays when time runs out)
- `timeup.mp3`  ← recommended
- `timeup.wav`
- `timer-end.mp3`  (legacy name, still supported)
- `timer-end.wav`

## Tips
- MP3 is recommended for best browser compatibility
- Keep files under 100KB for fast loading
- Adjust volume in `frontend/app/routes/game.tsx` (`playSound` calls)

## Example using ffmpeg to convert:
```bash
ffmpeg -i input.wav -ab 128k output.mp3
```
