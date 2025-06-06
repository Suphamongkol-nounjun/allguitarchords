const { chromium } = require('playwright');
const fs = require('fs');

const baseUrl = 'https://www.all-guitar-chords.com/';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeSelectedChordPlaywright() { // เปลี่ยนชื่อฟังก์ชันให้ทั่วไปมากขึ้น
  console.log('กำลังเริ่มต้นเบราว์เซอร์ด้วย Playwright...');
  let browser = null;
  let page;
  let selectedRootNoteName = 'UnknownRoot'; // ตัวแปรสำหรับเก็บชื่อ Root Note ที่คลิกจริง
  let selectedChordTypeName = 'UnknownType'; // ตัวแปรสำหรับเก็บชื่อ Chord Type ที่คลิกจริง

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36' // อัปเดต User Agent
    });
    page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('PAGE CONSOLE ERROR:', msg.text());
      } else {
        // console.log('PAGE CONSOLE:', msg.text()); // ลด log ที่ไม่จำเป็น
      }
    });

    console.log(`กำลังไปยัง URL: ${baseUrl}`);
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // --- ขั้นตอนที่ 0.5: ตรวจสอบและคลิก "Advanced" View ---
    console.log('กำลังตรวจสอบและตั้งค่ามุมมองเป็น "Advanced"...');
    try {
      const advancedViewToggleLocator = page.locator('span.button-link:has-text("Advanced")');
      await advancedViewToggleLocator.waitFor({ state: 'visible', timeout: 10000 });

      const isAdvancedActive = await advancedViewToggleLocator.evaluate(el => el.classList.contains('button-link-active'));

      if (!isAdvancedActive) {
        console.log('มุมมองปัจจุบันไม่ใช่ "Advanced", กำลังคลิกเพื่อเปลี่ยน...');
        const inactiveAdvancedButton = page.locator('span.button-link.button-link-inactive:has-text("Advanced")');
        await inactiveAdvancedButton.click();
        await delay(1000);
        console.log('เปลี่ยนเป็นมุมมอง "Advanced" เรียบร้อยแล้ว');
      } else {
        console.log('มุมมองเป็น "Advanced" อยู่แล้ว');
      }
    } catch (error) {
      console.warn('ไม่สามารถตรวจสอบหรือเปลี่ยนเป็นมุมมอง "Advanced" ได้:', error.message);
    }

    // --- ขั้นตอนที่ 1: คลิกเลือกปุ่ม Root Note "C" ---
    const targetRootNote = 'C'; // สามารถเปลี่ยนเป็น Root Note อื่นได้ในอนาคต
    console.log(`กำลังเลือก Root Note: ${targetRootNote}`);
    try {
      const cButtonLocator = page.getByRole('button', { name: targetRootNote, exact: true });
      await cButtonLocator.waitFor({ state: 'visible', timeout: 15000 });
      selectedRootNoteName = (await cButtonLocator.textContent()).trim(); // **แก้ไข: เก็บชื่อ Root Note จริง**
      await cButtonLocator.click();
      console.log(`คลิกเลือก Root Note "${selectedRootNoteName}" สำเร็จ`);
      await delay(1500);
    } catch (error) {
      console.error(`ขั้นตอนที่ 1 ไม่สำเร็จ (คลิก Root Note "${targetRootNote}"):`, error.message);
      if (page && !page.isClosed()) await page.screenshot({ path: 'playwright_error_step1_click_root.png' });
      throw error;
    }

    // --- ขั้นตอนที่ 2: คลิกเลือกปุ่ม Chord Type "Major" ---
    const targetChordType = 'Major'; // สามารถเปลี่ยนเป็น Chord Type อื่นได้ในอนาคต
    console.log(`กำลังเลือก Chord Type: ${targetChordType}`);
    try {
      const majorButtonLocator = page.getByRole('button', { name: targetChordType, exact: true });
      await majorButtonLocator.waitFor({ state: 'visible', timeout: 15000 });
      
      selectedChordTypeName = (await majorButtonLocator.textContent()).trim(); // **แก้ไข: เก็บชื่อ Chord Type จริง**
      console.log(`พบปุ่ม "${selectedChordTypeName}", กำลังพยายามคลิก...`);
      await majorButtonLocator.scrollIntoViewIfNeeded();
      await majorButtonLocator.click();
      
      console.log(`คลิกเลือก Chord Type "${selectedChordTypeName}" สำเร็จ`);
      await page.locator('div.fretboard.mt-2.m-auto.flex-col.fretboard-h').waitFor({ state: 'visible', timeout: 12000 });
      console.log('Fretboard แสดงผลแล้ว');
      await delay(1500);
    } catch (error) {
      console.error(`ขั้นตอนที่ 2 ไม่สำเร็จ (คลิก Chord Type "${targetChordType}" หรือ diagram ไม่โหลด):`, error.message);
      if (page && !page.isClosed()) await page.screenshot({ path: 'playwright_error_step2_click_type.png' });
      throw error;
    }

    // --- ขั้นตอนที่ 3: ดึงข้อมูลแพทเทิร์นทั้งหมด ---
    console.log('กำลังค้นหาปุ่มเลือกแพทเทิร์น (variants)...');
    const variantButtonSelector = 'div.flex.justify-center.flex-wrap.w-full.m-auto > div > div[class*="button"]';
    await page.locator(variantButtonSelector).first().waitFor({ state: 'visible', timeout: 10000 });
    const variantButtonLocators = await page.locator(variantButtonSelector).all();
    const totalVariants = variantButtonLocators.length;

    if (totalVariants > 0) console.log(`พบ ${totalVariants} แพทเทิร์นสำหรับคอร์ดปัจจุบัน`);
    else console.log("ไม่พบปุ่มแพทเทิร์น.");

    const currentChordAllPatternsData = [];

    for (let i = 0; i < totalVariants; i++) {
      const variantNumberDisplay = i + 1;
      console.log(`\nกำลังดึงข้อมูลแพทเทิร์นที่ ${variantNumberDisplay} จาก ${totalVariants}...`);
      const currentVariantButtonLocator = variantButtonLocators[i];
      let needsClick = true;
      if (i === 0) {
          const isActive = await currentVariantButtonLocator.evaluate(el => el.classList.contains('button-active'));
          if (isActive) {
              console.log(`แพทเทิร์น ${variantNumberDisplay} (แรก) โหลดอยู่แล้ว (active)`);
              needsClick = false;
          }
      }
      if (needsClick) {
          console.log(`กำลังคลิกปุ่มแพทเทิร์น ${variantNumberDisplay}...`);
          await currentVariantButtonLocator.scrollIntoViewIfNeeded();
          await currentVariantButtonLocator.click();
          console.log(`คลิกปุ่มแพทเทิร์น ${variantNumberDisplay} สำเร็จ`);
      }
      await delay(800); // เพิ่ม delay เล็กน้อยเพื่อให้ DOM อัปเดตสมบูรณ์

      const patternData = await page.evaluate(() => {
        const explicitNotes = []; // เปลี่ยนชื่อเป็น explicitNotes
        const mutedStrings = [];
        
        const getJsonStringNumber = (htmlStringRowIndex_eval) => {
          return htmlStringRowIndex_eval + 1; 
        };
        const fretboardContainer_eval = document.querySelector('div.fretboard.mt-2.m-auto.flex-col.fretboard-h');
        if (!fretboardContainer_eval) {
          return { notes: [], mutedStrings, error: 'ไม่พบ Fretboard container' };
        }
        const stringRowsHtml_eval = Array.from(fretboardContainer_eval.children);
        if (stringRowsHtml_eval.length < 7) {
            return { notes: [], mutedStrings, error: 'โครงสร้าง Fretboard ไม่ตรงตามที่คาด' };
        }
        const actualStringRows_eval = stringRowsHtml_eval.slice(1);
        if (actualStringRows_eval.length !== 6) {
          return { notes: [], mutedStrings, error: `พบ ${actualStringRows_eval.length} แถวสาย (คาดว่า 6)` };
        }

        actualStringRows_eval.forEach((stringRowDiv_eval, htmlStringIndex_eval) => {
          const jsonStringNum_eval = getJsonStringNumber(htmlStringIndex_eval);
          const fretCells_eval = Array.from(stringRowDiv_eval.querySelectorAll('div.note-fret'));
          if (fretCells_eval.length === 0) return;
          const firstFretCell_eval = fretCells_eval[0];
          const muteSpan_eval = firstFretCell_eval.querySelector('span.text-red.font-bold');
          if (muteSpan_eval && muteSpan_eval.textContent.trim().toUpperCase() === 'X') {
            mutedStrings.push(jsonStringNum_eval);
            return; 
          }
          fretCells_eval.forEach((fretCell_eval, fretCellIndex_eval) => {
            // **แก้ไข: Selector สำหรับ finger label span ให้แม่นยำขึ้น**
            const playedNoteSpan_eval = fretCell_eval.querySelector('span.rounded-full:not([class*="note-barre"])');
            // ถ้า selector ด้านบนยังไม่ได้ผล (เช่น finger label span ก็มี note-barre) ลองอันนี้:
            // const allRoundedSpans = Array.from(fretCell_eval.querySelectorAll('span.rounded-full'));
            // const playedNoteSpan_eval = allRoundedSpans.find(s => s.textContent.trim() !== "" && !s.classList.contains('pointer-events-none')) || 
            //                          (allRoundedSpans.length > 0 ? allRoundedSpans[allRoundedSpans.length - 1] : null);


            if (playedNoteSpan_eval) {
              let fingerLabel_eval = playedNoteSpan_eval.textContent.trim();
              if (fingerLabel_eval === "" || /^\s*$/.test(fingerLabel_eval)) {
                  // ตรวจสอบว่าเป็นตัวเลขหรือไม่ ถ้าไม่ใช่ ให้เป็น null
                  if (!/\d/.test(playedNoteSpan_eval.textContent)) {
                    fingerLabel_eval = null;
                  }
              }
              const fretNumber_eval = fretCellIndex_eval;
              if (fretNumber_eval > 0) { 
                if (fingerLabel_eval !== null) { // เพิ่มเฉพาะโน้ตที่มี finger label จริงๆ
                    explicitNotes.push({ // เก็บใน explicitNotes ก่อน
                        fret: fretNumber_eval,
                        string: jsonStringNum_eval,
                        label: fingerLabel_eval
                    });
                }
              }
            }
          });
        });

        // **เพิ่ม: Post-processing สำหรับ Barre Chords**
        const finalNotes = [...explicitNotes];
        const barreCandidates = {}; 

        explicitNotes.forEach(note => {
          if (note.label !== null && !isNaN(parseInt(note.label))) { 
            const key = `${note.fret}-${note.label}`;
            if (!barreCandidates[key]) {
              barreCandidates[key] = { fret: note.fret, label: note.label, strings: [] };
            }
            barreCandidates[key].strings.push(note.string);
          }
        });

        Object.values(barreCandidates).forEach(candidate => {
          if (candidate.strings.length >= 2) { 
            candidate.strings.sort((a, b) => a - b); 
            const minString = candidate.strings[0];
            const maxString = candidate.strings[candidate.strings.length - 1];

            for (let s_intermediate = minString + 1; s_intermediate < maxString; s_intermediate++) {
              if (!mutedStrings.includes(s_intermediate)) {
                const alreadyExists = explicitNotes.some(n => n.fret === candidate.fret && n.string === s_intermediate);
                if (!alreadyExists) {
                  finalNotes.push({ fret: candidate.fret, string: s_intermediate, label: candidate.label });
                }
              }
            }
          }
        });
        
        finalNotes.sort((a,b) => { // Optional: Sort for consistent output
            if (a.string === b.string) return a.fret - b.fret;
            return a.string - b.string;
        });

        return { notes: finalNotes, mutedStrings }; // คืน finalNotes ที่รวม barre แล้ว
      });

      if (patternData.error) {
        console.warn(`ไม่สามารถดึงข้อมูลแพทเทิร์น ${variantNumberDisplay}: ${patternData.error}`);
      } else if ((patternData.notes && patternData.notes.length > 0) || (patternData.mutedStrings && patternData.mutedStrings.length > 0)) {
        console.log(`ข้อมูลสำหรับแพทเทิร์น ${variantNumberDisplay}:`, JSON.stringify(patternData, null, 2));
        currentChordAllPatternsData.push(patternData);
      } else {
        console.warn(`แพทเทิร์น ${variantNumberDisplay} ไม่มีข้อมูล notes หรือ mutedStrings ที่ดึงได้`);
      }
    }

    const dynamicJsonKey = `${selectedRootNoteName}_${selectedChordTypeName.replace(/\s+/g, '')}`;
    console.log(`\n\n--- ข้อมูลคอร์ด ${dynamicJsonKey} ทั้งหมด (Playwright) ---`);
    const finalJsonOutput = { [dynamicJsonKey]: currentChordAllPatternsData };
    console.log(JSON.stringify(finalJsonOutput, null, 2));

    try {
      const safeRootNote = selectedRootNoteName.replace(/[^a-zA-Z0-9#]/g, '');
      const safeChordType = selectedChordTypeName.replace(/[^a-zA-Z0-9]/g, '');
      const outputFilename = `${safeRootNote}_${safeChordType}_playwright_data.json`;
      fs.writeFileSync(outputFilename, JSON.stringify(finalJsonOutput, null, 2), 'utf8');
      console.log(`\nข้อมูลถูกบันทึกในไฟล์ ${outputFilename} เรียบร้อยแล้ว`);
    } catch (fileError) {
      console.error(`เกิดข้อผิดพลาดในการบันทึกไฟล์: ${fileError.message}`);
    }

    console.log('การดึงข้อมูลเสร็จสิ้นสมบูรณ์');

  } catch (error) {
    console.error('เกิดข้อผิดพลาดใน scrapeSelectedChordPlaywright:', error.message);
    if (page && !page.isClosed()) {
        try {
            await page.screenshot({ path: 'playwright_main_error.png' });
            console.log('Screenshot at main error saved to playwright_main_error.png');
        } catch (ssError) {
            console.error('ไม่สามารถถ่าย screenshot:', ssError.message);
        }
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('ปิดเบราว์เซอร์เรียบร้อย (Playwright)');
    }
  }
}

scrapeSelectedChordPlaywright().catch(error => {
    console.error('เกิดข้อผิดพลาดร้ายแรงในการทำงานหลัก (Playwright):', error.message);
});
