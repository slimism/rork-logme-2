# Expected Output After Inserting Take 5 Before Take 3

## Final State:

```json
{
  "id": "1",
  "scene": "1",
  "shot": "1",
  "take": "1",
  "camera": "0001",
  "sound": "0001"
},
{
  "id": "2",
  "scene": "1",
  "shot": "1",
  "take": "2",
  "camera": "0002",
  "sound": "0002"
},
{
  "id": "7",  // Original take 5 (now take 3)
  "scene": "1",
  "shot": "1",
  "take": "3",
  "camera": "0003-0015",
  "sound": "0003",
  "camera1": "0003-0015"
},
{
  "id": "3",  // Original take 3 (now take 4)
  "scene": "1",
  "shot": "1",
  "take": "4",
  "camera": "0016-0020",
  "sound": "0004",
  "camera1": "0016-0020"
},
{
  "id": "4",  // SFX (position after inserted take)
  "sound": "0005",
  "classification": "SFX"
},
{
  "id": "5",  // Ambience (position after inserted take)
  "sound": "0006",
  "classification": "Ambience"
},
{
  "id": "6",  // Original take 4 (now take 5)
  "scene": "1",
  "shot": "1",
  "take": "5",
  "camera": "0021",
  "sound": "0007"
},
{
  "id": "8",  // Original take 6 (now take 6)
  "scene": "1",
  "shot": "1",
  "take": "6",
  "camera": "0022",
  "sound": "0008"
},
{
  "id": "9",  // Original take 7 (now take 7)
  "scene": "1",
  "shot": "1",
  "take": "7",
  "camera": "0023",
  "sound": "0009"
}
```

## Key Changes:

1. **Inserted Take 5** (id: 7) becomes new Take 3 with camera 0003-0015, sound 0003
   - `tempCamera = 15`, `tempSound = 3`

2. **Old Take 3** (id: 3) becomes Take 4:
   - Camera: 0016-0020 (preserves original delta of 5 files: delta = 7-3 = 4)
   - Sound: 0004 (sequential from inserted take's sound)
   - Update: `tempCamera = 20`, `tempSound = 4`

3. **SFX** (id: 4) - has sound file, positioned after inserted take:
   - Sound: 0005 (sequential: tempSound + 1 = 4 + 1 = 5)
   - No camera file (blank), so tempCamera remains 20
   - Update: `tempSound = 5`

4. **Ambience** (id: 5) - has sound file, positioned after inserted take:
   - Sound: 0006 (sequential: tempSound + 1 = 5 + 1 = 6)
   - No camera file (blank), so tempCamera remains 20
   - Update: `tempSound = 6`

5. **Old Take 4** (id: 6) becomes Take 5:
   - Camera: 0021 (sequential: tempCamera + 1 = 20 + 1 = 21)
   - Sound: 0007 (sequential: tempSound + 1 = 6 + 1 = 7)
   - Update: `tempCamera = 21`, `tempSound = 7`

6. **Old Take 6** (id: 8) becomes Take 6:
   - Camera: 0022 (sequential: tempCamera + 1 = 21 + 1 = 22)
   - Sound: 0008 (sequential: tempSound + 1 = 7 + 1 = 8)
   - Update: `tempCamera = 22`, `tempSound = 8`

7. **Old Take 7** (id: 9) becomes Take 7:
   - Camera: 0023 (sequential: tempCamera + 1 = 22 + 1 = 23)
   - Sound: 0009 (sequential: tempSound + 1 = 8 + 1 = 9)

## Calculation Summary:

- **tempCamera** progression: 15 → 20 → 20 (SFX blank) → 20 (Ambience blank) → 21 → 22 → 23
- **tempSound** progression: 3 → 4 → 5 (SFX) → 6 (Ambience) → 7 → 8 → 9
- Each subsequent log with a sound file uses: `newLower = tempSound + 1`
- Each subsequent log with a camera file uses: `newLower = tempCamera + 1`
- Blank fields (SFX/Ambience have no camera) don't update tempCamera, but do update tempSound

