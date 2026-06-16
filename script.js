const API_URL = 'https://script.google.com/macros/s/AKfycbza0kc1vlBbJE0aYW6DUNtkfNLr6vi-KLAa_yJ8NhrKHfivNCc2h3cf-Yq68YQlR8aV/exec';
const ADMIN_PASSWORD = 'admin123';

let interns = [];
let logs = [];
let tasks = [];
let editingInternId = null;
let editingTaskId = null;
let currentRole = null;
let foundIntern = null;
let selectedProfileId = null;
let calDate = new Date();

const SIDEBAR_OJT = `
  <div class="nav-label">My Portal</div>
  <div class="nav-item" onclick="navigate('checkin')">✓ Check In & Tasks</div>
  <div class="nav-item" onclick="navigate('tasks')">☑ Activity Board</div>
  <div class="nav-label">Reports</div>
  <div class="nav-item" onclick="navigate('calendar')">📅 Calendar</div>
  <div class="nav-item" onclick="navigate('dtr')">🖨 Print DTR</div>`;
const SIDEBAR_ADMIN = `
  <div class="nav-label">Admin</div>
  <div class="nav-item" onclick="navigate('dashboard')">▦ Dashboard</div>
  <div class="nav-item" onclick="navigate('interns')">👥 Interns</div>
  <div class="nav-item" onclick="navigate('attendance')">🕒 Attendance Log</div>
  <div class="nav-item" onclick="navigate('map')">🗺 Map Dashboard</div>
  <div class="nav-item" onclick="navigate('tasks')">☑ Activity Board</div>
  <div class="nav-label">Reports</div>
  <div class="nav-item" onclick="navigate('calendar')">📅 Calendar</div>
  <div class="nav-item" onclick="navigate('dtr')">🖨 Print DTR</div>`;
const PAGE_TITLES = {checkin:'Check In & Tasks',dashboard:'Dashboard',interns:'Interns',profile:'Intern Profile',attendance:'Attendance Log',tasks:'Activity Board',calendar:'Calendar',dtr:'Print DTR',map:'Map Dashboard'};

function $(id){ return document.getElementById(id); }
function uid(){ return Math.random().toString(36).slice(2,11); }
function today(){ return new Date().toISOString().slice(0,10); }
function escapeHtml(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function avatarHtml(intern, cls='intern-avatar'){
  const name = String(intern?.name || 'I');
  const initial = escapeHtml(name.charAt(0).toUpperCase() || 'I');
  const photo = intern?.photo || '';
  if(photo) return `<div class="${cls}"><img src="${photo}" alt="${escapeHtml(name)} photo"></div>`;
  return `<div class="${cls}">${initial}</div>`;
}
function tablePhotoHtml(intern){
  const name = String(intern?.name || 'Intern');
  return intern?.photo ? `<img class="table-photo" src="${intern.photo}" alt="${escapeHtml(name)} photo">` : `<div class="table-photo" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--accent-light)">${escapeHtml(name.charAt(0).toUpperCase() || 'I')}</div>`;
}
function setPhotoPreview(dataUrl){
  const box = $('photoPreview');
  if(!box) return;
  box.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Photo preview">` : '<span>No photo selected</span>';
}
function resizeImageFile(file, maxSize=420, quality=0.75){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function previewInternPhoto(){
  const file = $('fPhoto')?.files?.[0];
  if(!file){ setPhotoPreview(''); return; }
  try{ setPhotoPreview(await resizeImageFile(file)); }
  catch(err){ showToast(err.message, 'error'); }
}
async function getSelectedPhotoData(existing=''){
  const file = $('fPhoto')?.files?.[0];
  if(!file) return existing || '';
  return await resizeImageFile(file);
}
function formatDate(d){ return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—'; }
function formatTime(ts){ return ts ? new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'; }
function calcAge(bdate){ if(!bdate) return null; const b=new Date(bdate), n=new Date(); let a=n.getFullYear()-b.getFullYear(); if(n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
function isConfigured(){ return API_URL && !API_URL.includes('PASTE_YOUR'); }

async function api(action, payload = {}){
  if(!isConfigured()){
    $('setupNotice').style.display = 'block';
    throw new Error('Google Apps Script URL is not configured.');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  const data = await res.json();
  if(!data.ok) throw new Error(data.error || 'Server error');
  return data;
}

async function loadAllData(showSuccess=false){
  try{
    if(!isConfigured()) { $('setupNotice').style.display='block'; seedPreviewData(); renderCurrentPage(); return; }
    const data = await api('getAll');
    interns = data.interns || [];
    logs = data.logs || [];
    tasks = data.tasks || [];
    renderCurrentPage();
    if(showSuccess) showToast('Data refreshed from Google Sheets','success');
  }catch(err){
    console.error(err);
    showToast(err.message,'error');
  }
}

function seedPreviewData(){
  if(interns.length) return;
  interns = [
    {id:'INT-001',name:'Maria Santos',school:'University of the Philippines',birthdate:'2003-04-12',email:'maria.santos@example.com',course:'BS Computer Science',start:'2026-06-01',end:'2026-08-31',hours:'486',notes:'',photo:''},
    {id:'INT-002',name:'Jose Reyes',school:'Ateneo de Davao University',birthdate:'2002-09-25',email:'jose.reyes@example.com',course:'BS Information Technology',start:'2026-06-01',end:'2026-08-31',hours:'486',notes:''}
  ];
  tasks = [
    {id:uid(),title:'Complete onboarding forms',desc:'Fill out all required OJT forms.',priority:'high',status:'todo',assigned:'All Interns',date:today()},
    {id:uid(),title:'Submit weekly report',desc:'Prepare first weekly accomplishment report.',priority:'normal',status:'doing',assigned:'INT-001',date:today()}
  ];
}


function taskIsForIntern(task, intern){
  if(!intern) return false;
  const assigned = String(task.assigned || 'All Interns').toLowerCase();
  const name = String(intern.name || '').toLowerCase();
  const id = String(intern.id || '').toLowerCase();
  return assigned === 'all interns' || assigned.includes(name) || assigned.includes(id);
}
function visibleTasks(){
  if(currentRole !== 'ojt') return tasks;
  return foundIntern ? tasks.filter(t => taskIsForIntern(t, foundIntern)) : [];
}
function visibleLogs(){
  if(currentRole !== 'ojt') return logs;
  return foundIntern ? logs.filter(l => l.internId === foundIntern.id) : [];
}
function visibleInterns(){
  if(currentRole !== 'ojt') return interns;
  return foundIntern ? interns.filter(i => i.id === foundIntern.id) : [];
}
function requireInternLookupMessage(){
  return '<div class="empty-state"><p>Please go to Check In & Tasks first and enter your Intern ID to view your own records.</p></div>';
}

function updateClock(){ $('clock').textContent = new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
setInterval(updateClock,1000); updateClock();
window.addEventListener('DOMContentLoaded', () => { if(!isConfigured()) $('setupNotice').style.display='block'; loadAllData(); });

function enterAsOJT(){
  currentRole='ojt'; $('roleGate').style.display='none'; $('mainApp').style.display='flex'; buildSidebar();
  $('roleBadge').textContent='OJT'; $('roleBadge').className='sidebar-role-badge role-ojt'; navigate('checkin');
}
function openAdminLogin(){ $('adminPwInput').value=''; $('loginErr').classList.remove('show'); $('adminLogin').classList.add('open'); setTimeout(()=>$('adminPwInput').focus(),50); }
function closeAdminLogin(){ $('adminLogin').classList.remove('open'); }
function submitAdminLogin(){
  if($('adminPwInput').value === ADMIN_PASSWORD){ closeAdminLogin(); currentRole='admin'; $('roleGate').style.display='none'; $('mainApp').style.display='flex'; buildSidebar(); $('roleBadge').textContent='Admin'; $('roleBadge').className='sidebar-role-badge role-admin'; navigate('dashboard'); }
  else { $('loginErr').classList.add('show'); $('adminPwInput').value=''; $('adminPwInput').focus(); }
}
function signOut(){ currentRole=null; $('mainApp').style.display='none'; $('roleGate').style.display='flex'; clearCheckin(); }
function buildSidebar(){ $('sidebarNav').innerHTML = currentRole === 'admin' ? SIDEBAR_ADMIN : SIDEBAR_OJT; }
function renderCurrentPage(){ const active = document.querySelector('.page.active'); if(active) navigate(active.id.replace('page-','')); }
function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const el = $('page-'+page); if(!el) return; el.classList.add('active'); $('topbarTitle').textContent = PAGE_TITLES[page] || page;
  document.querySelectorAll('.nav-item').forEach(n => { if(n.textContent.toLowerCase().includes((PAGE_TITLES[page]||page).split(' ')[0].toLowerCase())) n.classList.add('active'); });
  if(page==='dashboard') renderDashboard();
  if(page==='interns') renderInternTable();
  if(page==='attendance'){ if(!$('logDate').value) $('logDate').value=today(); renderLogTable(); }
  if(page==='map') renderMapDashboard();
  if(page==='tasks') renderTasks();
  if(page==='calendar') renderCalendar();
  if(page==='dtr'){ populateDtrSelect(); if(!$('dtrMonth').value) $('dtrMonth').value=today().slice(0,7); renderDtrPreview(); }
  if(page==='profile') renderProfile(selectedProfileId);
}

function lookupIntern(){
  const val = $('internIdInput').value.trim().toUpperCase();
  $('notFoundMsg').classList.remove('visible'); $('internCard').classList.remove('visible'); $('ojtTasksSection').style.display='none';
  if(!val) return;
  foundIntern = interns.find(i => String(i.id).toUpperCase() === val);
  if(!foundIntern){ $('notFoundMsg').classList.add('visible'); return; }
  const now = new Date(), todayStr = today();
  $('internAvatar').innerHTML = foundIntern.photo ? `<img src="${foundIntern.photo}" alt="${escapeHtml(foundIntern.name)} photo">` : escapeHtml(foundIntern.name.charAt(0).toUpperCase());
  $('internName').textContent = foundIntern.name; $('internIdDisplay').textContent = 'ID: ' + foundIntern.id;
  $('internSchool').textContent = foundIntern.school; $('internEmail').textContent = foundIntern.email;
  $('internTime').textContent = formatTime(now.toISOString()); $('internDate').textContent = formatDate(todayStr);
  renderTodayAttendanceSummary();
  $('internCard').classList.add('visible'); renderOjtTasks(foundIntern); $('ojtTasksSection').style.display='block';
}
function attendanceLabel(type){
  return ({morning_in:'Morning Time In',morning_out:'Morning Time Out',afternoon_in:'Afternoon Time In',afternoon_out:'Afternoon Time Out'})[type] || 'Attendance';
}
function getLocation(){
  return new Promise(resolve => {
    if(!navigator.geolocation){ resolve({latitude:'',longitude:'',accuracy:''}); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({latitude:String(pos.coords.latitude), longitude:String(pos.coords.longitude), accuracy:String(Math.round(pos.coords.accuracy || 0))}),
      () => resolve({latitude:'',longitude:'',accuracy:''}),
      {enableHighAccuracy:true, timeout:12000, maximumAge:0}
    );
  });
}
function renderTodayAttendanceSummary(){
  const box = $('todayAttendanceSummary'); if(!box || !foundIntern) return;
  const todayLogs = logs.filter(l => l.internId === foundIntern.id && l.date === today());
  const types = ['morning_in','morning_out','afternoon_in','afternoon_out'];
  box.innerHTML = types.map(type => {
    const log = todayLogs.find(l => l.attendanceType === type);
    const loc = log && log.latitude && log.longitude ? `<a href="https://www.google.com/maps?q=${log.latitude},${log.longitude}" target="_blank">View map</a>` : 'No location';
    return `<div class="attendance-pill"><strong>${attendanceLabel(type)}</strong><span>${log ? formatTime(log.timestamp) : 'Not yet'}</span><small>${log ? loc : ''}</small></div>`;
  }).join('');
}
async function recordAttendance(type){
  if(!foundIntern){ showToast('Enter your Intern ID first.','error'); return; }
  const duplicate = logs.find(l => l.internId === foundIntern.id && l.date === today() && l.attendanceType === type);
  if(duplicate && !confirm(attendanceLabel(type) + ' already exists today. Save another record?')) return;
  showToast('Getting location and saving attendance...','success');
  const loc = await getLocation();
  const newLog = {id:uid(),internId:foundIntern.id,name:foundIntern.name,school:foundIntern.school,email:foundIntern.email,date:today(),timestamp:new Date().toISOString(),status:'present',attendanceType:type,latitude:loc.latitude,longitude:loc.longitude,accuracy:loc.accuracy,mapUrl:loc.latitude && loc.longitude ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}` : ''};
  try{ await api('addLog',{log:newLog}); logs.push(newLog); showToast(attendanceLabel(type)+' saved for '+foundIntern.name,'success'); renderTodayAttendanceSummary(); renderCurrentPage(); }
  catch(err){ showToast(err.message,'error'); }
}
async function confirmCheckin(){ return recordAttendance('morning_in'); }
function clearCheckin(){ $('internIdInput').value=''; $('internCard').classList.remove('visible'); $('notFoundMsg').classList.remove('visible'); $('ojtTasksSection').style.display='none'; foundIntern=null; }
function renderOjtTasks(intern){
  const myName = String(intern.name).toLowerCase(), myId = String(intern.id).toLowerCase();
  const myTasks = tasks.filter(t => { const a=String(t.assigned||'').toLowerCase(); return a==='all interns' || a.includes(myName) || a.includes(myId); });
  $('ojtTodayLabel').textContent = formatDate(today()); const list=$('ojtTaskList');
  if(!myTasks.length){ list.innerHTML='<div class="empty-state"><p>No tasks assigned to you yet.</p></div>'; return; }
  list.innerHTML = myTasks.map(t => taskItemHtml(t)).join('');
}
function taskItemHtml(t){
  const statusLabel = t.status==='done'?'Done':t.status==='doing'?'In Progress':'To Do';
  const badgeClass = t.status==='done'?'badge-success':t.status==='doing'?'badge-accent':'badge-warn';
  return `<div class="ojt-task-item"><div class="ojt-task-icon">${t.status==='done'?'✅':t.status==='doing'?'🔄':'📌'}</div><div style="flex:1"><div class="ojt-task-title">${escapeHtml(t.title)}</div>${t.desc?`<div class="ojt-task-desc">${escapeHtml(t.desc)}</div>`:''}<div class="ojt-task-meta"><span class="badge ${badgeClass}" style="font-size:11px">${statusLabel}</span>${t.priority==='high'?'<span class="badge badge-warn" style="font-size:11px">High Priority</span>':''}</div></div></div>`;
}

function renderDashboard(){
  const todayStr=today(); const todayLogs=logs.filter(l=>l.date===todayStr); const uniqueToday=[...new Set(todayLogs.map(l=>l.internId))].length;
  $('totalInterns').textContent=interns.length; $('presentToday').textContent=uniqueToday; $('totalLogs').textContent=logs.length; $('activeTasks').textContent=tasks.filter(t=>t.status!=='done').length;
  const recent=[...logs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,6);
  $('recentLogTable').innerHTML = recent.length ? recent.map(l=>`<tr><td class="td-name">${escapeHtml(l.name)}</td><td>${escapeHtml(l.school)}</td><td>${formatTime(l.timestamp)}</td></tr>`).join('') : `<tr><td colspan="3" class="td-muted">No check-ins yet.</td></tr>`;
  $('internListDash').innerHTML = interns.slice(0,6).map(i=>`<tr><td class="td-name"><div style="display:flex;align-items:center;gap:10px">${tablePhotoHtml(i)}<span>${escapeHtml(i.name)}</span></div></td><td>${escapeHtml(i.id)}</td><td>${escapeHtml(i.school)}</td><td><button class="btn btn-outline btn-xs" onclick="openProfile('${escapeHtml(i.id)}')">View</button></td></tr>`).join('') || `<tr><td colspan="4" class="td-muted">No interns yet.</td></tr>`;
}
function renderInternTable(){
  const q = ($('internSearch')?.value || '').toLowerCase();
  const rows = interns.filter(i => [i.id,i.name,i.school,i.email].join(' ').toLowerCase().includes(q));
  $('internTable').innerHTML = rows.map(i => `<tr><td>${escapeHtml(i.id)}</td><td class="td-name"><div style="display:flex;align-items:center;gap:10px">${tablePhotoHtml(i)}<span>${escapeHtml(i.name)}</span></div></td><td>${escapeHtml(i.school)}</td><td>${formatDate(i.birthdate)}</td><td>${escapeHtml(i.email)}</td><td><button class="btn btn-outline btn-xs" onclick="openProfile('${escapeHtml(i.id)}')">View</button> <button class="btn btn-outline btn-xs" onclick="editIntern('${escapeHtml(i.id)}')">Edit</button> <button class="btn btn-outline btn-xs danger-text" onclick="deleteIntern('${escapeHtml(i.id)}')">Delete</button></td></tr>`).join('') || `<tr><td colspan="6" class="td-muted">No interns found.</td></tr>`;
}
function openAddModal(){ editingInternId=null; $('modalTitle').textContent='Add New Intern'; ['fId','fName','fSchool','fBirth','fEmail','fCourse','fStart','fEnd','fHours','fNotes'].forEach(id=>$(id).value=''); if($('fPhoto')) $('fPhoto').value=''; setPhotoPreview(''); $('fId').disabled=false; $('addModal').classList.add('open'); }
function closeAddModal(){ $('addModal').classList.remove('open'); }
function editIntern(id){ const i=interns.find(x=>x.id===id); if(!i) return; editingInternId=id; $('modalTitle').textContent='Edit Intern'; $('fId').value=i.id; $('fId').disabled=true; $('fName').value=i.name||''; $('fSchool').value=i.school||''; $('fBirth').value=i.birthdate||''; $('fEmail').value=i.email||''; $('fCourse').value=i.course||''; $('fStart').value=i.start||''; $('fEnd').value=i.end||''; $('fHours').value=i.hours||''; $('fNotes').value=i.notes||''; if($('fPhoto')) $('fPhoto').value=''; setPhotoPreview(i.photo || ''); $('addModal').classList.add('open'); }
async function saveIntern(){
  const existing = interns.find(i => i.id === (editingInternId || $('fId').value.trim().toUpperCase())) || {};
  const intern = {id:$('fId').value.trim().toUpperCase(),name:$('fName').value.trim(),school:$('fSchool').value.trim(),birthdate:$('fBirth').value,email:$('fEmail').value.trim(),course:$('fCourse').value.trim(),start:$('fStart').value,end:$('fEnd').value,hours:$('fHours').value,notes:$('fNotes').value.trim(),photo: await getSelectedPhotoData(existing.photo)};
  if(!intern.id || !intern.name || !intern.school || !intern.email){ showToast('Please complete required fields.','error'); return; }
  if(!editingInternId && interns.some(i=>i.id===intern.id)){ showToast('Intern ID already exists.','error'); return; }
  try{ await api(editingInternId?'updateIntern':'addIntern',{intern}); const idx=interns.findIndex(i=>i.id===intern.id); if(idx>=0) interns[idx]=intern; else interns.push(intern); closeAddModal(); renderCurrentPage(); showToast('Intern saved','success'); }
  catch(err){ showToast(err.message,'error'); }
}
async function deleteIntern(id){
  if(!confirm('Delete this intern? Attendance logs will remain.')) return;
  try{ await api('deleteIntern',{id}); interns = interns.filter(i=>i.id!==id); renderCurrentPage(); showToast('Intern deleted','success'); }
  catch(err){ showToast(err.message,'error'); }
}
function openProfile(id){ selectedProfileId=id; navigate('profile'); }
function renderProfile(id){
  const i=interns.find(x=>x.id===id); if(!i){ $('profileHeader').innerHTML='<div class="td-muted">No intern selected.</div>'; return; }
  $('profileHeader').innerHTML = `${avatarHtml(i, 'profile-avatar')}<div><div class="profile-name">${escapeHtml(i.name)}</div><div class="profile-meta"><span class="badge badge-accent">${escapeHtml(i.id)}</span><span class="badge badge-purple">${escapeHtml(i.school)}</span></div></div>`;
  const fields = [['Email',i.email],['Course',i.course],['Birthdate',formatDate(i.birthdate)],['Age',calcAge(i.birthdate) ?? '—'],['Start Date',formatDate(i.start)],['End Date',formatDate(i.end)],['Required Hours',i.hours || '—'],['Notes',i.notes || '—']];
  $('profileGrid').innerHTML = fields.map(f=>`<div class="profile-field"><div class="profile-field-label">${f[0]}</div><div class="profile-field-value">${escapeHtml(f[1])}</div></div>`).join('');
  const myLogs=logs.filter(l=>l.internId===i.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)); $('profileAttCount').textContent = myLogs.length + ' records';
  $('profileAttTable').innerHTML = myLogs.map(l=>`<tr><td>${formatDate(l.date)}</td><td>${formatTime(l.timestamp)}</td><td><span class="badge badge-success">${escapeHtml(l.status)}</span></td></tr>`).join('') || `<tr><td colspan="3" class="td-muted">No records yet.</td></tr>`;
  const myTasks=tasks.filter(t=>String(t.assigned||'').toLowerCase().includes(i.id.toLowerCase()) || String(t.assigned||'').toLowerCase().includes(i.name.toLowerCase()) || String(t.assigned||'').toLowerCase()==='all interns'); $('profileTaskCount').textContent=myTasks.length+' tasks'; $('profileTaskList').innerHTML=myTasks.map(taskItemHtml).join('') || '<div class="empty-state"><p>No assigned tasks.</p></div>';
}

function renderLogTable(){
  const q=($('logSearch').value||'').toLowerCase(), d=$('logDate').value;
  const rows=logs.filter(l=>(!d||l.date===d) && [l.name,l.school,l.email,l.attendanceType].join(' ').toLowerCase().includes(q));
  $('logTable').innerHTML = rows.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map(l=>`<tr><td>${escapeHtml(l.internId)}</td><td class="td-name">${escapeHtml(l.name)}</td><td>${attendanceLabel(l.attendanceType)}</td><td>${formatDate(l.date)}</td><td>${formatTime(l.timestamp)}</td><td>${escapeHtml(l.latitude||'')}</td><td>${escapeHtml(l.longitude||'')}</td><td>${l.latitude&&l.longitude?`<a target="_blank" href="https://www.google.com/maps?q=${l.latitude},${l.longitude}">Map</a>`:'—'}</td></tr>`).join('') || `<tr><td colspan="8" class="td-muted">No logs found.</td></tr>`;
}
async function clearTodayLogs(){
  if(!confirm('Clear all check-ins for today?')) return;
  try{ await api('clearTodayLogs',{date:today()}); logs=logs.filter(l=>l.date!==today()); renderCurrentPage(); showToast('Today logs cleared','success'); }
  catch(err){ showToast(err.message,'error'); }
}

function openAddTaskModal(){ editingTaskId=null; $('taskModalTitle').textContent='Add Task'; ['tTitle','tDesc','tAssigned'].forEach(id=>$(id).value=''); $('tPriority').value='normal'; $('tStatus').value='todo'; $('tDate').value=today(); $('addTaskModal').classList.add('open'); }
function closeAddTaskModal(){ $('addTaskModal').classList.remove('open'); }
function editTask(id){ const t=tasks.find(x=>x.id===id); if(!t) return; editingTaskId=id; $('taskModalTitle').textContent='Edit Task'; $('tTitle').value=t.title||''; $('tDesc').value=t.desc||''; $('tPriority').value=t.priority||'normal'; $('tStatus').value=t.status||'todo'; $('tAssigned').value=t.assigned||''; $('tDate').value=t.date||today(); $('addTaskModal').classList.add('open'); }
async function saveTask(){
  const task={id:editingTaskId||uid(),title:$('tTitle').value.trim(),desc:$('tDesc').value.trim(),priority:$('tPriority').value,status:$('tStatus').value,assigned:$('tAssigned').value.trim()||'All Interns',date:$('tDate').value||today()};
  if(!task.title){ showToast('Task title is required.','error'); return; }
  try{ await api(editingTaskId?'updateTask':'addTask',{task}); const idx=tasks.findIndex(t=>t.id===task.id); if(idx>=0) tasks[idx]=task; else tasks.push(task); closeAddTaskModal(); renderCurrentPage(); showToast('Task saved','success'); }
  catch(err){ showToast(err.message,'error'); }
}
async function deleteTask(id){ if(!confirm('Delete this task?')) return; try{ await api('deleteTask',{id}); tasks=tasks.filter(t=>t.id!==id); renderTasks(); showToast('Task deleted','success'); }catch(err){ showToast(err.message,'error'); } }
async function setTaskStatus(id,status){ const t=tasks.find(x=>x.id===id); if(!t) return; if(currentRole==='ojt' && !taskIsForIntern(t, foundIntern)){ showToast('You can only move tasks assigned to you.','error'); return; } t.status=status; try{ await api('updateTask',{task:t}); renderTasks(); showToast('Task updated','success'); }catch(err){ showToast(err.message,'error'); } }
function renderTasks(){
  const taskSource = visibleTasks();
  const addBtn = document.querySelector('#page-tasks .page-heading .btn-primary');
  if(addBtn) addBtn.style.display = currentRole === 'admin' ? '' : 'none';
  if(currentRole === 'ojt' && !foundIntern){
    ['todo','doing','done'].forEach(status=>{ $('count-'+status).textContent='0'; $('col-'+status).innerHTML=requireInternLookupMessage(); });
    return;
  }
  ['todo','doing','done'].forEach(status=>{
    const list = taskSource.filter(t=>t.status===status);
    $('count-'+status).textContent = list.length;
    $('col-'+status).innerHTML = list.map(t=>taskCardHtml(t)).join('') || '<div class="empty-state"><p>No tasks.</p></div>';
  });
}
function taskCardHtml(t){
  const statusButtons = `${t.status!=='todo'?`<button class="task-btn" onclick="setTaskStatus('${escapeHtml(t.id)}','todo')">To Do</button>`:''}${t.status!=='doing'?`<button class="task-btn" onclick="setTaskStatus('${escapeHtml(t.id)}','doing')">Doing</button>`:''}${t.status!=='done'?`<button class="task-btn" onclick="setTaskStatus('${escapeHtml(t.id)}','done')">Done</button>`:''}`;
  const adminButtons = currentRole === 'admin' ? `<button class="task-btn" onclick="editTask('${escapeHtml(t.id)}')">Edit</button>${statusButtons}<button class="task-btn del" onclick="deleteTask('${escapeHtml(t.id)}')">Delete</button>` : statusButtons;
  return `<div class="task-card"><div class="task-card-title">${escapeHtml(t.title)}</div>${t.desc?`<div class="task-card-desc">${escapeHtml(t.desc)}</div>`:''}<div class="task-card-meta"><span class="badge ${t.priority==='high'?'badge-warn':'badge-accent'}">${escapeHtml(t.priority||'normal')}</span><span class="td-muted">${escapeHtml(t.assigned||'All Interns')}</span><span class="td-muted">${formatDate(t.date)}</span></div><div class="task-card-actions">${adminButtons}</div></div>`;
}

let attendanceMapInstance = null;
function renderMapDashboard(){
  const mapEl = $('attendanceMap');
  const table = $('mapLogTable');
  if(!mapEl || !table) return;
  const locationLogs = logs.filter(l => l.latitude && l.longitude).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  $('mapCount').textContent = locationLogs.length + ' records';
  table.innerHTML = locationLogs.slice(0,100).map(l=>`<tr><td>${escapeHtml(l.name)}</td><td>${attendanceLabel(l.attendanceType)}</td><td>${formatDate(l.date)}</td><td>${formatTime(l.timestamp)}</td><td><a target="_blank" href="https://www.google.com/maps?q=${l.latitude},${l.longitude}">${escapeHtml(l.latitude)}, ${escapeHtml(l.longitude)}</a></td></tr>`).join('') || '<tr><td colspan="5" class="td-muted">No attendance locations yet.</td></tr>';
  if(typeof L === 'undefined'){
    mapEl.innerHTML = '<div class="empty-state"><p>Map library did not load. Check your internet connection.</p></div>';
    return;
  }
  if(attendanceMapInstance){ attendanceMapInstance.remove(); attendanceMapInstance = null; }
  attendanceMapInstance = L.map('attendanceMap');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'&copy; OpenStreetMap'}).addTo(attendanceMapInstance);
  if(!locationLogs.length){ attendanceMapInstance.setView([8.4542,124.6319], 12); return; }
  const group = L.featureGroup();
  locationLogs.forEach(l=>{
    const marker = L.marker([Number(l.latitude), Number(l.longitude)]).bindPopup(`<strong>${escapeHtml(l.name)}</strong><br>${attendanceLabel(l.attendanceType)}<br>${formatDate(l.date)} ${formatTime(l.timestamp)}<br>Accuracy: ${escapeHtml(l.accuracy||'')} m`);
    marker.addTo(group);
  });
  group.addTo(attendanceMapInstance);
  attendanceMapInstance.fitBounds(group.getBounds().pad(0.2));
}
function renderCalendar(){
  if(currentRole === 'ojt' && !foundIntern){ $('calGrid').innerHTML = requireInternLookupMessage(); $('calMonthLabel').textContent = 'My Calendar'; $('dayPanelDate').textContent='Intern ID required'; $('dayPanelEvents').innerHTML=requireInternLookupMessage(); return; }
  const y=calDate.getFullYear(), m=calDate.getMonth(); $('calMonthLabel').textContent = calDate.toLocaleDateString('en-PH',{month:'long',year:'numeric'});
  const start=new Date(y,m,1), end=new Date(y,m+1,0); const first=start.getDay(); const days=end.getDate();
  const headers=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-header">${d}</div>`).join(''); let cells='';
  for(let i=0;i<first;i++) cells += '<div class="cal-cell other-month"></div>';
  for(let day=1; day<=days; day++){
    const date=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; const ev=getEventsForDate(date); const isToday=date===today();
    cells += `<div class="cal-cell ${isToday?'today':''}" onclick="selectCalendarDay('${date}')"><div class="cal-cell-num">${day}</div>${ev.slice(0,3).map(e=>`<div class="cal-event ${e.type}">${escapeHtml(e.title)}</div>`).join('')}${ev.length>3?`<div class="cal-more">+${ev.length-3} more</div>`:''}</div>`;
  }
  $('calGrid').innerHTML=headers+cells;
}
function getEventsForDate(date){
  const ev=[]; visibleTasks().filter(t=>t.date===date).forEach(t=>ev.push({type:'task',title:t.title,sub:t.assigned}));
  visibleLogs().filter(l=>l.date===date).forEach(l=>ev.push({type:'checkin',title:l.name+' checked in',sub:formatTime(l.timestamp)}));
  const md=date.slice(5); visibleInterns().filter(i=>i.birthdate && i.birthdate.slice(5)===md).forEach(i=>ev.push({type:'bday',title:i.name+' birthday',sub:i.school})); return ev;
}
function selectCalendarDay(date){ const ev=getEventsForDate(date); $('dayPanelDate').textContent=formatDate(date); $('dayPanelEvents').innerHTML= ev.map(e=>`<div class="day-event-item"><div class="day-event-icon">${e.type==='task'?'📌':e.type==='bday'?'🎂':'✅'}</div><div><div class="day-event-title">${escapeHtml(e.title)}</div><div class="day-event-sub">${escapeHtml(e.sub||'')}</div></div></div>`).join('') || '<div class="empty-state"><p>No events for this day.</p></div>'; }
function calShift(n){ calDate.setMonth(calDate.getMonth()+n); renderCalendar(); }
function calGoToday(){ calDate=new Date(); renderCalendar(); selectCalendarDay(today()); }

function populateDtrSelect(){
  const select = $('dtrInternSelect');
  if(currentRole === 'ojt'){
    if(!foundIntern){ select.innerHTML = '<option value="">Enter Intern ID first</option>'; select.disabled = true; return; }
    select.disabled = true;
    select.innerHTML = `<option value="${escapeHtml(foundIntern.id)}">${escapeHtml(foundIntern.name)} (${escapeHtml(foundIntern.id)})</option>`;
    select.value = foundIntern.id;
    return;
  }
  select.disabled = false;
  select.innerHTML = '<option value="">— Select Intern —</option>' + interns.map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} (${escapeHtml(i.id)})</option>`).join('');
}
function renderDtrPreview(){
  if(currentRole === 'ojt' && !foundIntern){ $('dtrPreviewWrap').style.display='block'; $('dtrPreviewLabel').textContent='Intern ID required'; $('dtrPreviewContainer').innerHTML=requireInternLookupMessage(); return; }
  const id=$('dtrInternSelect').value, ym=$('dtrMonth').value; if(!id || !ym){ $('dtrPreviewWrap').style.display='none'; return; }
  const intern=interns.find(i=>i.id===id); if(!intern) return; const html=makeDtrHtml(intern,ym); $('dtrPreviewContainer').innerHTML=html; $('dtrPreviewLabel').textContent=`${intern.name} — ${ym}`; $('dtrPreviewWrap').style.display='block';
}
function makeDtrHtml(intern,ym){
  const [y,m]=ym.split('-').map(Number); const days=new Date(y,m,0).getDate(); const monthName=new Date(y,m-1,1).toLocaleDateString('en-PH',{month:'long',year:'numeric'});
  const myLogs=logs.filter(l=>l.internId===intern.id && l.date.startsWith(ym)); let totalDays=0;
  let rows='';
  for(let d=1; d<=31; d++){
    const dayLogs=myLogs.filter(l=>Number(l.date.slice(8))===d);
    const valid=d<=days;
    const mi=dayLogs.find(l=>l.attendanceType==='morning_in');
    const mo=dayLogs.find(l=>l.attendanceType==='morning_out');
    const ai=dayLogs.find(l=>l.attendanceType==='afternoon_in');
    const ao=dayLogs.find(l=>l.attendanceType==='afternoon_out');
    if(valid && dayLogs.length) totalDays++;
    const ft = log => log ? formatTime(log.timestamp).replace(/:\d{2} /,' ') : '';
    rows += `<tr><td class="day-col">${d}</td><td>${valid ? ft(mi) : ''}</td><td>${valid ? ft(mo) : ''}</td><td>${valid ? ft(ai) : ''}</td><td>${valid ? ft(ao) : ''}</td><td>${valid && dayLogs.length ? '1' : ''}</td></tr>`;
  }
  const internName = escapeHtml(String(intern.name || '').toUpperCase());
  const internId = escapeHtml(intern.id || '');
  const heading = `<div class="dtr-print-heading"><h2>DAILY TIME RECORD</h2><div>Intern: <strong>${internName}</strong> &nbsp; | &nbsp; ID: <strong>${internId}</strong> &nbsp; | &nbsp; Period: <strong>${escapeHtml(monthName)}</strong></div></div>`;
  const one = `<div class="dtr-single"><div class="dtr-form-no">Civil Service Form No. 48</div><div class="dtr-title">DAILY TIME RECORD</div><div class="dtr-subtitle">${escapeHtml(monthName)}</div><div class="dtr-name-row">${internName}</div><div class="dtr-name-label">Name of Intern</div><div class="dtr-info-row">Intern ID: <span class="dtr-info-val">${internId}</span></div><div class="dtr-info-row">Official hours for arrival: <span class="dtr-info-val">${escapeHtml($('dtrOfficialArrival').value)}</span> departure: <span class="dtr-info-val">${escapeHtml($('dtrOfficialDepart').value)}</span></div><table class="dtr-table"><thead><tr><th rowspan="2">Day</th><th colspan="2">A.M.</th><th colspan="2">P.M.</th><th rowspan="2">Total</th></tr><tr><th>Arrival</th><th>Departure</th><th>Arrival</th><th>Departure</th></tr></thead><tbody>${rows}<tr class="dtr-total-row"><td colspan="5">TOTAL DAYS</td><td>${totalDays}</td></tr></tbody></table><div class="dtr-footer"><div class="dtr-cert">I certify on my honor that the above is a true and correct report of the hours of work performed.</div><div class="dtr-sig-row"><div class="dtr-sig-block"><div class="dtr-sig-name">${internName}</div><div class="dtr-sig-label">Signature of Intern</div></div><div class="dtr-sig-block"><div class="dtr-verified">Verified as to the prescribed office hours:</div><div class="dtr-sig-name">${escapeHtml($('dtrInCharge').value)}</div><div class="dtr-sig-label">In-Charge</div></div></div></div></div>`;
  return `<div class="dtr-wrap" id="dtrPrintArea">${heading}<div class="dtr-pair">${one}${one}</div></div>`;
}
function printDtr(){
  renderDtrPreview();
  if(currentRole === 'ojt' && !foundIntern){ showToast('Enter your Intern ID first before printing DTR.','error'); return; }
  if($('dtrPreviewWrap').style.display==='none'){ showToast('Select intern and month first.','error'); return; }
  window.print();
}

function showToast(msg,type='success'){ const t=$('toast'); $('toastMsg').textContent=msg; $('toastIcon').textContent=type==='success'?'✓':'!'; t.className='toast '+type+' show'; setTimeout(()=>t.classList.remove('show'),3000); }


// Make functions available to HTML onclick handlers
Object.assign(window, {
  enterAsOJT, openAdminLogin, closeAdminLogin, submitAdminLogin, signOut, navigate,
  loadAllData, lookupIntern, confirmCheckin, recordAttendance, clearCheckin,
  openAddModal, closeAddModal, saveIntern, editIntern, deleteIntern, openProfile,
  renderInternTable, renderLogTable, clearTodayLogs, previewInternPhoto,
  openAddTaskModal, closeAddTaskModal, saveTask, editTask, deleteTask, setTaskStatus,
  calShift, calGoToday, selectCalendarDay, renderMapDashboard, renderDtrPreview, printDtr
});
