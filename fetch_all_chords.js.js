const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { transformApiResponse } = require('./transformer'); 

// =================================================================
// 1. ค่าคงที่และข้อมูลตั้งต้น
// =================================================================

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_TYPES = [
  "Major", "Minor", "7", "5", "dim", "dim7", "aug", "sus2", "sus4", // <--- เปลี่ยน "minor" เป็น "Minor"
  "maj7", "m7", "7sus4", "maj9", "maj11", "maj13", "maj9#11", "maj13#11",
  "add9", "6add9", "maj7b5", "maj7#5", "m6", "m9", "m11", "m13", "madd9",
  "m6add9", "mmaj7", "mmaj9", "m7b5", "m7#5", "6", "9", "11", "13",
  "7b5", "7#5", "7b9", "7#9", "7(b5,b9)", "7(b5,#9)", "7(#5,b9)", "7(#5,#9)",
  "9b5", "9#5", "13#11", "13b9", "11b9", "sus2sus4", "-5"
];

const API_BASE_URL = 'https://www.all-guitar-chords.com/chords/find';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



// =================================================================
// 3. ฟังก์ชันหลักในการทำงาน (อัปเดตชื่อไฟล์)
// =================================================================
const main = async () => {
    console.log('Starting to fetch and process all guitar chords...');
    const allChordsData = { chords: {} };
    let fetchedCount = 0;

    for (let rootNoteId = 0; rootNoteId < ROOT_NOTES.length; rootNoteId++) {
        for (let chordTypeId = 0; chordTypeId < CHORD_TYPES.length; chordTypeId++) {
            const rootNote = ROOT_NOTES[rootNoteId];
            const chordType = CHORD_TYPES[chordTypeId];
            const chordName = `${rootNote}_${chordType}`;
            const url = `${API_BASE_URL}/${rootNoteId}/${chordTypeId}`;

            console.log(`Fetching: ${chordName}`);

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const apiResponse = await response.json();

                if (apiResponse && apiResponse.results && apiResponse.results.length > 0) {
                    const transformedData = transformApiResponse(apiResponse);
                    allChordsData.chords[chordName] = transformedData;
                    fetchedCount++;
                }
            } catch (error) {
                // Ignore fetch errors for non-existent chords
            }

            await sleep(150); 
        }
    }

    // <--- เปลี่ยนชื่อไฟล์ตรงนี้
    const outputFileName = 'all_guitar_chords_complete_data.json';
    const outputPath = path.join(__dirname, outputFileName);

    console.log(`\nProcessing complete. Fetched ${fetchedCount} chords.`);
    console.log(`Saving data to ${outputPath}...`);

    fs.writeFileSync(outputPath, JSON.stringify(allChordsData, null, 2));

    console.log('All done!');
}

main();