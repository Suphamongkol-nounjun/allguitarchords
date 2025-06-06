// merge_files.js
const fs = require('fs');
const path = require('path');

const directoryPath = '.'; // หรือ './' หมายถึงโฟลเดอร์ปัจจุบันที่รันสคริปต์นี้
const outputFilename = 'all_guitar_chords_complete_data2.json';
const mergedChords = {}; // Object สำหรับเก็บข้อมูล chords ทั้งหมด

try {
  // อ่านไฟล์ทั้งหมดใน directory ปัจจุบัน
  const files = fs.readdirSync(directoryPath);

  // กรองเอาเฉพาะไฟล์ JSON ที่สร้างจากสคริปต์ scraper
  const chordDataFiles = files.filter(file => file.startsWith('data_') && file.endsWith('.json'));

  if (chordDataFiles.length === 0) {
    console.log('ไม่พบไฟล์ข้อมูล (data_....json) สำหรับรวม');
    return;
  }

  console.log(`พบไฟล์ข้อมูล ${chordDataFiles.length} ไฟล์: ${chordDataFiles.join(', ')}`);

  // วน Loop อ่านและรวมข้อมูลจากแต่ละไฟล์
  for (const file of chordDataFiles) {
    console.log(`กำลังอ่านไฟล์: ${file}`);
    const filePath = path.join(directoryPath, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    // ตรวจสอบว่ามี key "chords" และเป็น object หรือไม่
    if (jsonData && typeof jsonData.chords === 'object') {
      // ใช้ Object.assign เพื่อรวม object 'chords' จากไฟล์ปัจจุบันเข้าไปใน 'mergedChords'
      Object.assign(mergedChords, jsonData.chords);
    } else {
      console.warn(`ไฟล์ ${file} ไม่มีโครงสร้าง { "chords": {...} } ที่ถูกต้อง, ข้ามไฟล์นี้...`);
    }
  }

  // สร้างโครงสร้าง JSON สุดท้าย
  const finalJsonOutput = { "chords": mergedChords };

  // บันทึกไฟล์ที่รวมแล้ว
  fs.writeFileSync(outputFilename, JSON.stringify(finalJsonOutput, null, 2), 'utf8');
  console.log(`\nรวมข้อมูลทั้งหมดสำเร็จ! ผลลัพธ์ถูกบันทึกในไฟล์: ${outputFilename}`);

} catch (error) {
  console.error('เกิดข้อผิดพลาดระหว่างการรวมไฟล์:', error);
}