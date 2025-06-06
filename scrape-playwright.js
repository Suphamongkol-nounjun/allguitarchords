const { chromium } = require('playwright');
const fs = require('fs');

const baseUrl = 'https://www.all-guitar-chords.com/';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ฟังก์ชันสำหรับดึงข้อมูลของคอร์ดที่ระบุ (Root Note และ Chord Type)
async function scrapeSpecificChord(page, targetRootNote, targetChordType) {
  console.log(`\n--- เริ่มกระบวนการสำหรับ ${targetRootNote} ${targetChordType} ---`);
  let currentSelectedRootNoteName = targetRootNote;
  let currentSelectedChordTypeName = targetChordType;

  // --- ขั้นตอนที่ 1: คลิกเลือกปุ่ม Root Note ---
  console.log(`(ภายใน scrapeSpecificChord) กำลังเลือก Root Note: ${targetRootNote}`);
  try {
    const rootNoteButtonLocator = page.getByRole('button', { name: targetRootNote, exact: true });
    await rootNoteButtonLocator.waitFor({ state: 'visible', timeout: 15000 });
    currentSelectedRootNoteName = (await rootNoteButtonLocator.textContent()).trim();
    await rootNoteButtonLocator.click();
    console.log(`(ภายใน scrapeSpecificChord) คลิกเลือก Root Note "${currentSelectedRootNoteName}" สำเร็จ`);
    await delay(1500);
  } catch (error) {
    console.error(`(ภายใน scrapeSpecificChord) ขั้นตอนที่ 1 ไม่สำเร็จ (คลิก Root Note "${targetRootNote}"):`, error.message);
    return { key: `${targetRootNote}_${targetChordType.replace(/\s+/g, '')}`, data: [], error: `Root Note "${targetRootNote}" not clickable or found.` };
  }

 // --- ขั้นตอนที่ 2: คลิกเลือกปุ่ม Chord Type ---
  console.log(`(ภายใน scrapeSpecificChord) กำลังเลือก Chord Type: ${targetChordType}`);
  try {
    const chordTypeButtonLocator = page.getByRole('button', { name: targetChordType, exact: true });
    await chordTypeButtonLocator.waitFor({ state: 'visible', timeout: 15000 });
    currentSelectedChordTypeName = (await chordTypeButtonLocator.textContent()).trim();
    console.log(`(ภายใน scrapeSpecificChord) พบปุ่ม "${currentSelectedChordTypeName}", กำลังพยายามคลิก...`);

    // **แก้ไข: รอ network request แทนการรอเปลี่ยนสีปุ่ม**
    // เริ่มรอ network request ที่จะเกิดขึ้น *ก่อน* ที่จะสั่งคลิก
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/chords/find/') && response.status() === 200,
      { timeout: 10000 }
    );

    // สั่งคลิกปุ่ม
    await chordTypeButtonLocator.click();

    // รอให้ network request นั้นทำงานเสร็จ
    await responsePromise;
    console.log(`Network request สำหรับ "${currentSelectedChordTypeName}" สำเร็จแล้ว`);
    
    console.log(`(ภายใน scrapeSpecificChord) คลิกเลือก Chord Type "${currentSelectedChordTypeName}" สำเร็จ`);
    await page.locator('div.fretboard.mt-2.m-auto.flex-col.fretboard-h').waitFor({ state: 'visible', timeout: 12000 });
    console.log('(ภายใน scrapeSpecificChord) Fretboard แสดงผลแล้ว');
    await delay(1500); // รอให้ UI render ข้อมูลที่ได้จาก request
  } catch (error) {
    console.error(`(ภายใน scrapeSpecificChord) ขั้นตอนที่ 2 ไม่สำเร็จ (คลิก Chord Type "${targetChordType}"):`, error.message);
    console.warn(`อาจจะไม่มี Chord Type "${targetChordType}" สำหรับ Root Note "${currentSelectedRootNoteName}" บนหน้าเว็บ หรือชื่อไม่ตรง`);
    const fallbackKey = `${currentSelectedRootNoteName}_${targetChordType.replace(/\s+/g, '')}`;
    return { key: fallbackKey, data: [], error: `Chord Type "${targetChordType}" not found for root "${currentSelectedRootNoteName}"` };
  }

  // --- ขั้นตอนที่ 3: ดึงข้อมูลแพทเทิร์นทั้งหมด ---
  console.log('(ภายใน scrapeSpecificChord) กำลังค้นหาปุ่มเลือกแพทเทิร์น (variants)...');
  const variantButtonSelector = 'div.flex.justify-center.flex-wrap.w-full.m-auto > div > div[class*="button"]';
  let totalVariants = 0;
  let variantButtonLocators = [];
  try {
      await page.locator(variantButtonSelector).first().waitFor({ state: 'visible', timeout: 10000 });
      variantButtonLocators = await page.locator(variantButtonSelector).all();
      totalVariants = variantButtonLocators.length;
  } catch (e) {
      console.warn(`(ภายใน scrapeSpecificChord) ไม่พบปุ่ม Variant แรกสำหรับ ${currentSelectedRootNoteName} ${currentSelectedChordTypeName}, อาจจะไม่มีแพทเทิร์น: ${e.message}`);
      const fallbackKey = `${currentSelectedRootNoteName}_${currentSelectedChordTypeName.replace(/\s+/g, '')}`;
      return { key: fallbackKey, data: [] };
  }

  if (totalVariants > 0) console.log(`(ภายใน scrapeSpecificChord) พบ ${totalVariants} แพทเทิร์นสำหรับ ${currentSelectedRootNoteName} ${currentSelectedChordTypeName}`);
  else console.log(`(ภายใน scrapeSpecificChord) ไม่พบปุ่มแพทเทิร์นสำหรับ ${currentSelectedRootNoteName} ${currentSelectedChordTypeName}`);

  const currentChordAllPatternsData = [];

  for (let i = 0; i < totalVariants; i++) {
    const variantNumberDisplay = i + 1;
    console.log(`\n(ภายใน scrapeSpecificChord) กำลังดึงข้อมูลแพทเทิร์นที่ ${variantNumberDisplay} จาก ${totalVariants} สำหรับ ${currentSelectedRootNoteName} ${currentSelectedChordTypeName}...`);
    const currentVariantButtonLocator = variantButtonLocators[i];
    let needsClick = true;
    if (i === 0) {
        const isActive = await currentVariantButtonLocator.evaluate(el => el.classList.contains('button-active'));
        if (isActive) {
            console.log(`(ภายใน scrapeSpecificChord) แพทเทิร์น ${variantNumberDisplay} (แรก) โหลดอยู่แล้ว (active)`);
            needsClick = false;
        }
    }
        if (needsClick) {
        console.log(`(ภายใน scrapeSpecificChord) กำลังคลิกปุ่มแพทเทิร์น ${variantNumberDisplay}...`);
        await currentVariantButtonLocator.scrollIntoViewIfNeeded();

        await Promise.all([
            // รอให้ปุ่มนี้มี class 'button-active'
            page.waitForFunction(
                (buttonElement) => {
                    return buttonElement.classList.contains('button-active');
                },
                await currentVariantButtonLocator.elementHandle(), 
                { timeout: 5000 }
            ),
            // สั่งคลิกปุ่ม
            currentVariantButtonLocator.click()
        ]);
        
        console.log(`(ภายใน scrapeSpecificChord) คลิกปุ่มแพทเทิร์น ${variantNumberDisplay} และยืนยันสถานะ Active สำเร็จ`);
    }
    await delay(500);

    const patternData = await page.evaluate(() => {
      const explicitNotes = [];
      const mutedStrings_eval = [];
      const getJsonStringNumber = (htmlStringRowIndex_eval) => {
        return htmlStringRowIndex_eval + 1;
      };
      const fretboardContainer_eval = document.querySelector('div.fretboard.mt-2.m-auto.flex-col.fretboard-h');
      if (!fretboardContainer_eval) {
        return { notes: [], error: 'ไม่พบ Fretboard container' };
      }
      const stringRowsHtml_eval = Array.from(fretboardContainer_eval.children);
      if (stringRowsHtml_eval.length < 7) {
          return { notes: [], error: 'โครงสร้าง Fretboard ไม่ตรงตามที่คาด' };
      }
      const actualStringRows_eval = stringRowsHtml_eval.slice(1);
      if (actualStringRows_eval.length !== 6) {
        return { notes: [], error: `พบ ${actualStringRows_eval.length} แถวสาย (คาดว่า 6)` };
      }
      actualStringRows_eval.forEach((stringRowDiv_eval, htmlStringIndex_eval) => {
        const jsonStringNum_eval = getJsonStringNumber(htmlStringIndex_eval);
        const fretCells_eval = Array.from(stringRowDiv_eval.querySelectorAll('div.note-fret'));
        if (fretCells_eval.length === 0) return;
        const firstFretCell_eval = fretCells_eval[0];
        const muteSpan_eval = firstFretCell_eval.querySelector('span.text-red.font-bold');
        if (muteSpan_eval && muteSpan_eval.textContent.trim().toUpperCase() === 'X') {
          mutedStrings_eval.push(jsonStringNum_eval);
          return;
        }
        fretCells_eval.forEach((fretCell_eval, fretCellIndex_eval) => {
          const playedNoteSpan_eval = fretCell_eval.querySelector('span.rounded-full');
          if (playedNoteSpan_eval) {
            const fretNumber_eval = fretCellIndex_eval;
            if (fretNumber_eval === 0) {
              const textContent_eval = playedNoteSpan_eval.textContent.trim();
              if (!/\d/.test(textContent_eval)) {
                explicitNotes.push({
                  fret: 0,
                  string: jsonStringNum_eval
                });
              }
            } else {
              const fingerLabelSpan_eval = fretCell_eval.querySelector('span.rounded-full:not([class*="note-barre"])');
              if (fingerLabelSpan_eval) {
                  const textContent_finger_eval = fingerLabelSpan_eval.textContent.trim();
    
    // รับค่าทั้งตัวเลขและตัวอักษร (เช่น T สำหรับ Thumb)
    if (textContent_finger_eval) {
        explicitNotes.push({
            fret: fretNumber_eval,
            string: jsonStringNum_eval,
            label: textContent_finger_eval // เก็บค่าทั้งตัวเลขและตัวอักษร
        });
              }
              }}
          }
        });
      });
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
        if (candidate.strings.length >= 2 && !isNaN(parseInt(candidate.label))) {
          candidate.strings.sort((a, b) => a - b);
          const minString = candidate.strings[0];
          const maxString = candidate.strings[candidate.strings.length - 1];
          for (let s_intermediate = minString + 1; s_intermediate < maxString; s_intermediate++) {
            if (!mutedStrings_eval.includes(s_intermediate)) {
              const alreadyExists = explicitNotes.some(n => n.fret === candidate.fret && n.string === s_intermediate);
              const isAlreadyOpenAndPlayed = explicitNotes.some(n => n.fret === 0 && n.string === s_intermediate && candidate.fret === 0);
              if (!alreadyExists && !isAlreadyOpenAndPlayed) {
                finalNotes.push({ fret: candidate.fret, string: s_intermediate, label: candidate.label });
              }
            }
          }
        }
      });
      
      // **แก้ไข: เรียงลำดับ finalNotes ตาม fret ก่อน แล้วค่อยตาม string**
      finalNotes.sort((a,b) => {
          if (a.fret === b.fret) return a.string - b.string; // ถ้า fret เท่ากัน ให้เรียงตาม string
          return a.fret - b.fret; // เรียงตาม fret ก่อน
      });
      
      const resultData = { notes: finalNotes };
      if (mutedStrings_eval.length > 0) {
        resultData.mutedStrings = mutedStrings_eval;
      }
      return resultData;
    });

    if (patternData.error) {
      console.warn(`(ภายใน scrapeSpecificChord) ไม่สามารถดึงข้อมูลแพทเทิร์น ${variantNumberDisplay}: ${patternData.error}`);
    } else if ((patternData.notes && patternData.notes.length > 0) || patternData.hasOwnProperty('mutedStrings')) {
      console.log(`(ภายใน scrapeSpecificChord) ข้อมูลสำหรับแพทเทิร์น ${variantNumberDisplay}:`, JSON.stringify(patternData, null, 2));
      currentChordAllPatternsData.push(patternData);
    } else {
      console.warn(`(ภายใน scrapeSpecificChord) แพทเทิร์น ${variantNumberDisplay} ไม่มีข้อมูล notes หรือ mutedStrings ที่ดึงได้`);
    }
  }
  const dynamicJsonKey = `${currentSelectedRootNoteName}_${currentSelectedChordTypeName.replace(/\s+/g, '')}`;
  return { key: dynamicJsonKey, data: currentChordAllPatternsData };
}


async function scrapeAllChordsAllTypes() {
  console.log('กำลังเริ่มต้นเบราว์เซอร์หลักด้วย Playwright...');
  let browser = null;
  let page;
  const collectedChordsData = {};

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
    });
    page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('PAGE CONSOLE ERROR:', msg.text());
      }
    });

    console.log(`กำลังไปยัง URL: ${baseUrl}`);
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });

    console.log('กำลังพยายามคลิก "Advanced" View...');
    try {
      const advancedButtonLocator = page.locator('div').filter({ hasText: /^Advanced$/ }).nth(1);
      await advancedButtonLocator.waitFor({ state: 'visible', timeout: 10000 });
      await advancedButtonLocator.click();
      console.log('คลิก "Advanced" View สำเร็จ (หรือพยายามคลิกแล้ว)');
      await delay(2000); 
    } catch (error) {
      console.warn('ไม่สามารถคลิก "Advanced" View ด้วย locator ที่ให้มา, ลองวิธี fallback...');
      try {
        const inactiveAdvancedButton = page.locator('span.button-link.button-link-inactive:has-text("Advanced")');
        const activeAdvancedDiv = page.locator('div.button-active:has(span:has-text("Advanced"))');
        await Promise.race([
          inactiveAdvancedButton.waitFor({ state: 'visible', timeout: 7000 }).catch(() => null),
          activeAdvancedDiv.waitFor({ state: 'visible', timeout: 7000 }).catch(() => null)
        ]);
        const isAlreadyAdvanced = await activeAdvancedDiv.isVisible();
        if (!isAlreadyAdvanced && (await inactiveAdvancedButton.isVisible())) {
            console.log('มุมมองปัจจุบันไม่ใช่ "Advanced" (fallback), กำลังคลิกเพื่อเปลี่ยน...');
            await inactiveAdvancedButton.click();
            await activeAdvancedDiv.waitFor({ state: 'visible', timeout: 5000 });
            console.log('เปลี่ยนเป็นมุมมอง "Advanced" เรียบร้อยแล้ว (fallback)');
            await delay(1500);
        } else if (isAlreadyAdvanced) {
            console.log('มุมมองเป็น "Advanced" อยู่แล้ว (fallback check)');
        } else {
            console.warn('ไม่สามารถยืนยันหรือเปลี่ยนเป็น Advanced view ด้วยวิธี fallback');
        }
      } catch (fallbackError) {
        console.warn('เกิดข้อผิดพลาดกับวิธี fallback สำหรับ "Advanced" View:', fallbackError.message);
        if (page && !page.isClosed()) await page.screenshot({ path: 'playwright_error_advanced_view.png' });
      }
    }

    // **แก้ไข: กำหนด Root Note ที่จะดึง (สำหรับทดลองแค่ "C")**
    // const rootNoteNamesToScrape = ['C']; 
    const rootNoteNamesToScrape = []; // ถ้าต้องการดึงทั้งหมด ให้ comment บรรทัดบน และ uncomment ส่วนดึง rootNoteNames ด้านล่าง

    // --- (ส่วนดึง Root Notes ทั้งหมด: ถ้าต้องการดึงทั้งหมดให้ uncomment ส่วนนี้) ---
    
    console.log("กำลังดึงรายชื่อ Root Notes ทั้งหมด...");
    try {
        const rootNoteButtonsContainerSelector = 'div.flex.flex-wrap';
        await page.waitForSelector(`${rootNoteButtonsContainerSelector} button`, { state: 'visible', timeout: 15000 });
        const rootNoteButtonLocators = await page.locator(`${rootNoteButtonsContainerSelector} button`).all();
        for (const locator of rootNoteButtonLocators) {
            const name = (await locator.textContent()).trim();
            if (name && name.length <= 2) {
                rootNoteNamesToScrape.push(name);
            }
        }
        console.log(`พบ Root Notes: ${rootNoteNamesToScrape.join(', ')}`);
        if (rootNoteNamesToScrape.length === 0) throw new Error("ไม่พบ Root Notes");
    } catch (error) {
        console.error(`ไม่สามารถดึงรายชื่อ Root Notes: ${error.message}`);
        if (page && !page.isClosed()) await page.screenshot({ path: 'playwright_error_get_root_notes.png' });
        throw error;
    }
    

    for (const currentRootNote of rootNoteNamesToScrape) { // **แก้ไข: ใช้ rootNoteNamesToScrape**
      console.log(`\n===== เริ่มดึงข้อมูลสำหรับ Root Note: ${currentRootNote} =====`);
      try {
        const rootNoteButtonLocator = page.getByRole('button', { name: currentRootNote, exact: true });
        await rootNoteButtonLocator.waitFor({ state: 'visible', timeout: 15000});
        await rootNoteButtonLocator.click();
        console.log(`คลิก Root Note "${currentRootNote}" เพื่อแสดง Chord Types สำเร็จ`);
        console.log('รอให้ปุ่ม Chord Type โหลด...');
        try {
            await page.getByRole('button', { name: '-5', exact: true }).waitFor({ state: 'visible', timeout: 20000 });
            console.log('ปุ่ม Chord Type "-5" ปรากฏแล้ว.');
        } catch (e) {
            console.warn('ไม่พบปุ่ม Chord Type "-5", จะรอปุ่มแรกใน container แทน...');
            await page.waitForSelector(`div.text-center button`, { state: 'visible', timeout:15000 });
        }
        await delay(1000);
      } catch (error) {
        console.error(`ไม่สามารถคลิก Root Note "${currentRootNote}" ใน loop หลัก: ${error.message}`);
        continue;
      }

      console.log(`กำลังดึงรายชื่อ Chord Types ทั้งหมดสำหรับ Root Note: ${currentRootNote}...`);
      const discoveredChordTypes = [];
      try {
          const chordTypeButtonsContainerSelector = 'div.text-center';
          await page.waitForSelector(`${chordTypeButtonsContainerSelector} button`, { state: 'visible', timeout:15000 });
          const chordTypeButtonLocators = await page.locator(`${chordTypeButtonsContainerSelector} button`).all();
          if (chordTypeButtonLocators.length === 0) {
              console.warn(`ไม่พบปุ่ม Chord Type ใดๆ สำหรับ Root Note ${currentRootNote}`);
          }
          for (const locator of chordTypeButtonLocators) {
              const typeName = (await locator.textContent()).trim();
              if (typeName) discoveredChordTypes.push(typeName);
          }
          console.log(`พบ Chord Types ${discoveredChordTypes.length} ประเภทสำหรับ ${currentRootNote}: ${discoveredChordTypes.join(', ')}`);
      } catch (error) {
          console.error(`เกิดข้อผิดพลาดในการดึงรายชื่อ Chord Types สำหรับ ${currentRootNote}: ${error.message}`);
      }

      if (discoveredChordTypes.length === 0) {
          console.warn(`ไม่พบ Chord Types สำหรับ ${currentRootNote}, ข้าม...`);
          continue;
      }

      for (const discoveredType of discoveredChordTypes) {
        try {
          const result = await scrapeSpecificChord(page, currentRootNote, discoveredType);
          if (result && result.key) {
            if (result.error) {
              console.warn(`ไม่สามารถดึงข้อมูลสำหรับ ${result.key}: ${result.error}`);
              collectedChordsData[result.key] = [{error: result.error, patterns: []}];
            } else if (result.data) {
              collectedChordsData[result.key] = result.data;
            }
          }
        } catch (chordError) {
          console.error(`เกิดข้อผิดพลาดขณะดึงข้อมูลสำหรับ ${currentRootNote} ${discoveredType}: ${chordError.message}`);
          const errorKey = `${currentRootNote}_${discoveredType.replace(/\s+/g, '')}`;
          collectedChordsData[errorKey] = [{ error: `Failed to scrape: ${chordError.message}`, patterns: [] }];
        }
      }
    }

    const finalJsonOutput = { "chords": collectedChordsData };
    console.log(`\n\n--- ข้อมูลคอร์ดทั้งหมดที่ดึงได้ (Playwright) ---`);
    console.log(JSON.stringify(finalJsonOutput, null, 2));

    try {
      const outputFilename = `all_guitar_chords_complete_data.json`;
      fs.writeFileSync(outputFilename, JSON.stringify(finalJsonOutput, null, 2), 'utf8');
      console.log(`\nข้อมูลทั้งหมดถูกบันทึกในไฟล์ ${outputFilename} เรียบร้อยแล้ว`);
    } catch (fileError) {
      console.error(`เกิดข้อผิดพลาดในการบันทึกไฟล์: ${fileError.message}`);
    }

    console.log('การดึงข้อมูลทั้งหมดเสร็จสิ้นสมบูรณ์');

  } catch (error) {
    console.error('เกิดข้อผิดพลาดใน scrapeAllChordsAllTypes:', error.message);
    if (page && !page.isClosed()) {
        try {
            await page.screenshot({ path: 'playwright_main_orchestrator_error.png' });
            console.log('Screenshot at main orchestrator error saved to playwright_main_orchestrator_error.png');
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

scrapeAllChordsAllTypes().catch(error => {
    console.error('เกิดข้อผิดพลาดร้ายแรงในการทำงานหลัก (Playwright):', error.message);
});
