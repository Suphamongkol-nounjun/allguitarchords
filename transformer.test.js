// transformer.test.js

const { transformApiResponse } = require('./transformer');

// กลุ่มการทดสอบสำหรับฟังก์ชัน transformApiResponse
describe('transformApiResponse', () => {

  // =====================================================================
  // Test Case 1: Sanity Check - คอร์ดเปิดธรรมดา (ยังคงเดิม)
  // =====================================================================
  test('should correctly transform a simple open chord (C Major)', () => {
    const rawApiInput = {
      results: [{
        strings: [
          [{ fretNo: 0, symbol: null }],
          [{ fretNo: 1, symbol: "1" }],
          [{ fretNo: 0, symbol: null }],
          [{ fretNo: 2, symbol: "2" }],
          [{ fretNo: 3, symbol: "3" }],
          [{ isMuted: true, symbol: "X" }]
        ]
      }]
    };
    const expectedOutput = [{
      notes: [
        { fret: 0, string: 1 },
        { fret: 0, string: 3 },
        { fret: 1, string: 2, label: "1" },
        { fret: 2, string: 4, label: "2" },
        { fret: 3, string: 5, label: "3" },
      ],
      mutedStrings: [6]
    }];
    expect(transformApiResponse(rawApiInput)).toEqual(expectedOutput);
  });

  // =====================================================================
  // Test Case 2: จากข้อมูลจริง - ทดสอบ "คอร์ดทาบเว้นช่วง" (C# Minor, id:268)
  // =====================================================================
  test('should correctly fill skipped strings in a barre (Real data: C#m id:268)', () => {
    const rawApiInput = {
      results: [{
        strings: [
          [{ fretNo: 9, isRootNote: true, barre: 5, symbol: "1" }], // Str 1
          [{ fretNo: 9, barre: true, symbol: "1" }],                // Str 2
          [{ fretNo: 9, barre: true, symbol: "1" }],                // Str 3
          [{ fretNo: 11, isRootNote: true, symbol: "4" }],           // Str 4
          [{ fretNo: 11, symbol: "3" }],                             // Str 5
          [{ fretNo: 9, isRootNote: true, barre: true, symbol: "1" }] // Str 6
        ]
      }]
    };

    // ผลลัพธ์ที่คาดหวัง: มี 6 โน้ตเดิม + 2 โน้ตที่เติมเข้าไป = 8 โน้ต
    const expectedOutput = [{
      notes: [
        { fret: 9, string: 1, label: "1" },
        { fret: 9, string: 2, label: "1" },
        { fret: 9, string: 3, label: "1" },
        { fret: 9, string: 4, label: "1" }, // เติม
        { fret: 9, string: 5, label: "1" }, // เติม
        { fret: 9, string: 6, label: "1" },
        { fret: 11, string: 4, label: "4" }, // ของเดิม
        { fret: 11, string: 5, label: "3" }  // ของเดิม
      ]
    }];
    expect(transformApiResponse(rawApiInput)).toEqual(expectedOutput);
  });

  // =====================================================================
  // Test Case 3: จากข้อมูลจริง - ทดสอบ "ทาบบางส่วน" (Partial Barre) (C#9#5, id:381)
  // =====================================================================
  test('should correctly fill a partial barre with conflicting notes (Real data: C#9#5 id:381)', () => {
    const rawApiInput = {
      results: [{
        strings: [
          [{ fretNo: 6, symbol: "4" }],      // Str 1
          [{ fretNo: 3, barre: 2, symbol: "1" }], // Str 2 (start barre)
          [{ fretNo: 4, symbol: "3" }],      // Str 3
          [{ fretNo: 3, barre: true, symbol: "1" }], // Str 4 (end barre)
          [{ fretNo: 4, isRootNote: true, symbol: "2" }], // Str 5
          [{ isMuted: true, symbol: "X" }]     // Str 6
        ]
      }]
    };

    const expectedOutput = [{
      notes: [
        { fret: 3, string: 2, label: "1" },
        { fret: 3, string: 3, label: "1" }, // เติม
        { fret: 3, string: 4, label: "1" },
        { fret: 4, string: 3, label: "3" }, // ของเดิม
        { fret: 4, string: 5, label: "2" }, // ของเดิม
        { fret: 6, string: 1, label: "4" },
      ],
      mutedStrings: [6]
    }];
    expect(transformApiResponse(rawApiInput)).toEqual(expectedOutput);
  });
  
  // =====================================================================
  // Test Case 4: จากข้อมูลจริง - ทดสอบ Label "T" (นิ้วโป้ง) (C#9#5, id:380)
  // =====================================================================
  test('should handle thumb label "T" correctly (Real data: C#9#5 id:380)', () => {
    const rawApiInput = {
        results: [{
            strings: [
                [{ fretNo: 10, symbol: "3" }],    // Str 1
                [{ fretNo: 11, symbol: "4" }],    // Str 2
                [{ fretNo: 10, symbol: "2" }],    // Str 3
                [{ fretNo: 9, symbol: "1" }],     // Str 4
                [{ isMuted: true, symbol: "X" }], // Str 5
                [{ fretNo: 9, isRootNote: true, symbol: "T" }] // Str 6
            ]
        }]
    };

    const expectedOutput = [{
        notes: [
            { fret: 9, string: 4, label: "1" },
            { fret: 9, string: 6, label: "T" }, // ต้องแสดง T
            { fret: 10, string: 1, label: "3" },
            { fret: 10, string: 3, label: "2" },
            { fret: 11, string: 2, label: "4" },
        ],
        mutedStrings: [5]
    }];
    expect(transformApiResponse(rawApiInput)).toEqual(expectedOutput);
  });

  // =====================================================================
  // Test Case 5: Edge Case - ไม่เติมโน้ตทับ "สายบอด" (ยังคงเดิม)
  // =====================================================================
  test('should NOT fill a barre note on an explicitly muted string (C_m9 id:62)', () => {
    const rawApiInput = {
        results: [{
            strings: [
                [{ fretNo: 10, symbol: "4" }],
                [{ fretNo: 8, symbol: "1" }],
                [{ fretNo: 8, symbol: "1" }],
                [{ fretNo: 8, symbol: "1" }],
                [{ isMuted: true, symbol: "X" }],
                [{ fretNo: 8, symbol: "1" }]
            ]
        }]
    };
    const expectedOutput = [{
        notes: [
            { fret: 8, string: 2, label: "1" },
            { fret: 8, string: 3, label: "1" },
            { fret: 8, string: 4, label: "1" },
            { fret: 8, string: 6, label: "1" },
            { fret: 10, string: 1, label: "4" },
        ],
        mutedStrings: [5]
    }];
    expect(transformApiResponse(rawApiInput)).toEqual(expectedOutput);
  });

  // =====================================================================
  // Test Case 6: Edge Case - ไม่สร้าง key "mutedStrings" (ยังคงเดิม)
  // =====================================================================
 test('should omit the mutedStrings key when no strings are muted (F Major)', () => {
    const rawApiInput = {
      results: [{
        strings: [
          [{ fretNo: 1, symbol: "1" }],
          [{ fretNo: 1, symbol: "1" }],
          [{ fretNo: 2, symbol: "2" }],
          [{ fretNo: 3, symbol: "4" }],
          [{ fretNo: 3, symbol: "3" }],
          [{ fretNo: 1, symbol: "1" }]
        ]
      }]
    };
    
    // *** เฉลยที่ถูกต้อง (มี 9 notes) ***
    const expectedOutput = [{
      notes: [
        { fret: 1, string: 1, label: "1" },
        { fret: 1, string: 2, label: "1" },
        { fret: 1, string: 3, label: "1" }, // เติม
        { fret: 1, string: 4, label: "1" }, // เติม
        { fret: 1, string: 5, label: "1" }, // เติม
        { fret: 1, string: 6, label: "1" },
        { fret: 2, string: 3, label: "2" }, // ของเดิม
        { fret: 3, string: 4, label: "4" }, // ของเดิม
        { fret: 3, string: 5, label: "3" }, // ของเดิม
      ]
    }];

    const result = transformApiResponse(rawApiInput);
    expect(result).toEqual(expectedOutput);
    expect(result[0].mutedStrings).toBeUndefined();
  });
});