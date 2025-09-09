// transformer.js

function transformApiResponse(apiResponse) {
  // ... โค้ดทั้งหมดของฟังก์ชัน transformApiResponse ที่เราทำล่าสุด ...
  // ตรรกะ "Additive Barre Fill" ที่ถูกต้อง
  if (!apiResponse || !apiResponse.results) {
    return [];
  }

  const transformedVariations = [];

  for (const variation of apiResponse.results) {
    const initialNotes = [];
    const mutedStrings = [];

    variation.strings.forEach((stringData, index) => {
      const stringNumber = index + 1;
      const stringInfo = stringData[0];
      if (stringInfo.isMuted) {
        mutedStrings.push(stringNumber);
      } else {
        const note = { fret: stringInfo.fretNo, string: stringNumber };
        if (stringInfo.symbol && stringInfo.symbol !== 'X') {
          note.label = stringInfo.symbol;
        }
        initialNotes.push(note);
      }
    });

    const fingerMap = {};
    for (const note of initialNotes) {
      if (note.label) {
        const key = `${note.fret}-${note.label}`;
        if (!fingerMap[key]) fingerMap[key] = [];
        fingerMap[key].push(note.string);
      }
    }

    const finalNotes = [...initialNotes];

    for (const key in fingerMap) {
      const stringsPressed = fingerMap[key];
      if (stringsPressed.length >= 2) {
        const [fret, label] = key.split('-');
        const minString = Math.min(...stringsPressed);
        const maxString = Math.max(...stringsPressed);
        
        const existingBarreNotes = new Set(
          initialNotes
            .filter(n => n.fret === parseInt(fret) && n.label === label)
            .map(n => n.string)
        );

        for (let s = minString; s <= maxString; s++) {
          if (!existingBarreNotes.has(s) && !mutedStrings.includes(s)) {
            finalNotes.push({
              fret: parseInt(fret),
              string: s,
              label: label,
            });
          }
        }
      }
    }
    
    finalNotes.sort((a, b) => {
      if (a.fret !== b.fret) return a.fret - b.fret;
      return a.string - b.string;
    });

    const variationObject = { notes: finalNotes };
    if (mutedStrings.length > 0) {
      variationObject.mutedStrings = mutedStrings.sort((a, b) => a - b);
    }
    
    transformedVariations.push(variationObject);
  }

  return transformedVariations;
}

// ส่งออกฟังก์ชันเพื่อให้ไฟล์อื่นเรียกใช้ได้
module.exports = { transformApiResponse };