/*
  InternTrack Google Apps Script Backend
  1. Create a Google Sheet.
  2. Extensions > Apps Script.
  3. Paste this code.
  4. Run setup() once.
  5. Deploy > New deployment > Web app.
     Execute as: Me
     Who has access: Anyone
  6. Copy Web App URL and paste it into script.js as API_URL.
*/

const SHEETS = {
  interns: 'Interns',
  logs: 'Logs',
  tasks: 'Tasks'
};

const HEADERS = {
  Interns: ['id','name','school','birthdate','email','course','start','end','hours','notes'],
  Logs: ['id','internId','name','school','email','date','timestamp','status'],
  Tasks: ['id','title','desc','priority','status','assigned','date']
};

function setup(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if(!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS[name].length).setFontWeight('bold');
  });

  const interns = ss.getSheetByName(SHEETS.interns);
  interns.getRange(2,1,2,HEADERS.Interns.length).setValues([
    ['INT-001','Maria Santos','University of the Philippines','2003-04-12','maria.santos@example.com','BS Computer Science','2026-06-01','2026-08-31','486',''],
    ['INT-002','Jose Reyes','Ateneo de Davao University','2002-09-25','jose.reyes@example.com','BS Information Technology','2026-06-01','2026-08-31','486','']
  ]);

  const tasks = ss.getSheetByName(SHEETS.tasks);
  tasks.getRange(2,1,2,HEADERS.Tasks.length).setValues([
    [makeId(),'Complete onboarding forms','Fill out all required OJT forms.','high','todo','All Interns',todayString_()],
    [makeId(),'Submit weekly report','Prepare first weekly accomplishment report.','normal','doing','INT-001',todayString_()]
  ]);
}

function doGet(){
  return json_({ok:true, message:'InternTrack API is running. Use POST requests from the website.'});
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = body.action;

    if(action === 'getAll') return json_({ok:true, interns: readSheet_(SHEETS.interns), logs: readSheet_(SHEETS.logs), tasks: readSheet_(SHEETS.tasks)});

    if(action === 'addIntern') { upsert_(SHEETS.interns, body.intern, 'id'); return json_({ok:true}); }
    if(action === 'updateIntern') { upsert_(SHEETS.interns, body.intern, 'id'); return json_({ok:true}); }
    if(action === 'deleteIntern') { deleteByKey_(SHEETS.interns, 'id', body.id); return json_({ok:true}); }

    if(action === 'addLog') { append_(SHEETS.logs, body.log); return json_({ok:true}); }
    if(action === 'clearTodayLogs') { deleteByKey_(SHEETS.logs, 'date', body.date); return json_({ok:true}); }

    if(action === 'addTask') { upsert_(SHEETS.tasks, body.task, 'id'); return json_({ok:true}); }
    if(action === 'updateTask') { upsert_(SHEETS.tasks, body.task, 'id'); return json_({ok:true}); }
    if(action === 'deleteTask') { deleteByKey_(SHEETS.tasks, 'id', body.id); return json_({ok:true}); }

    return json_({ok:false, error:'Unknown action: ' + action});
  }catch(err){
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function readSheet_(sheetName){
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sh) return [];
  const values = sh.getDataRange().getDisplayValues();
  if(values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i] || '');
    return obj;
  });
}

function append_(sheetName, obj){
  const sh = getOrCreateSheet_(sheetName);
  const headers = getHeaders_(sh);
  sh.appendRow(headers.map(h => obj[h] || ''));
}

function upsert_(sheetName, obj, key){
  if(!obj || !obj[key]) throw new Error('Missing object or key: ' + key);
  const sh = getOrCreateSheet_(sheetName);
  const headers = getHeaders_(sh);
  const keyCol = headers.indexOf(key) + 1;
  if(keyCol < 1) throw new Error('Key column not found: ' + key);
  const lastRow = sh.getLastRow();
  const rowValues = headers.map(h => obj[h] || '');
  if(lastRow >= 2){
    const keys = sh.getRange(2,keyCol,lastRow-1,1).getDisplayValues().flat();
    const index = keys.findIndex(v => String(v).toUpperCase() === String(obj[key]).toUpperCase());
    if(index >= 0){
      sh.getRange(index+2,1,1,headers.length).setValues([rowValues]);
      return;
    }
  }
  sh.appendRow(rowValues);
}

function deleteByKey_(sheetName, key, value){
  const sh = getOrCreateSheet_(sheetName);
  const headers = getHeaders_(sh);
  const keyCol = headers.indexOf(key) + 1;
  if(keyCol < 1) throw new Error('Key column not found: ' + key);
  const lastRow = sh.getLastRow();
  if(lastRow < 2) return;
  const keys = sh.getRange(2,keyCol,lastRow-1,1).getDisplayValues().flat();
  for(let i=keys.length-1; i>=0; i--){
    if(String(keys[i]) === String(value)) sh.deleteRow(i+2);
  }
}

function getOrCreateSheet_(sheetName){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(sheetName);
  if(!sh){
    sh = ss.insertSheet(sheetName);
    const headers = HEADERS[sheetName] || [];
    if(headers.length) sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sh;
}

function getHeaders_(sh){
  const lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1,1,1,lastCol).getDisplayValues()[0].filter(String);
}

function makeId(){
  return Math.random().toString(36).substring(2,11);
}

function todayString_(){
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
