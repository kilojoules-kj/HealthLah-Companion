const fs = require('fs');
const path = require('path');
const src = 'C:/Users/kel25/Documents/Github/HealthLah/HealthLah-Companion/everly-main/frontend';
const dst = 'C:/Users/kel25/Documents/Github/HealthLah/HealthLah-Companion/frontend';

function readSrc(relPath) {
  return fs.readFileSync(path.join(src, relPath), 'utf8');
}

function writeDst(relPath, content) {
  const fullPath = path.join(dst, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Wrote', relPath);
}

// ================ LANDING PAGE ================
// We already have this file written via the glob. Let's just write from scratch via the content we prepared.
// Instead of complex regex, let's just read the original and do simple string replacements.

let landing = readSrc('components/landing-page.tsx');

// Simple global replacements
const simpleReplacements = [
  // Branding
  ['Everly', 'HealthLah'],
  ['everly', 'healthlah'],
  ['/create-elder', '/register-patient'],
  ['/create-caregiver', '/#features'],
  ['#why-everly', '#why-healthlah'],
  ['why-everly', 'why-healthlah'],
  ['Why HealthLah', 'Why HealthLah'],  // already correct after Everly->HealthLah
  // Demo persona
  ['Dorothy', 'Mr. Tan'],
  ['dorothy', 'mr-tan'],
  // Locations
  ['Toronto, ON', 'Singapore'],
  ['America/Toronto', 'Asia/Singapore'],
  ['Seattle', 'Toa Payoh'],
  // Phone format
  ['+1 (555) 123-4567', '+65 9123 4567'],
  ['+1 (416) 555-0199', '+65 8234 5678'],
  ['+1 555 000 0000', '+65 9000 0000'],
  ['+1 937 598 3675', '+65 9375 9836'],
  ['+15551234567', '+6591234567'],
];

for (const [from, to] of simpleReplacements) {
  landing = landing.split(from).join(to);
}

writeDst('components/landing-page.tsx', landing);

// ================ DASHBOARD (demo persona) ================
let dashboard = readSrc('components/dashboard.tsx');
const dashReplacements = [
  ['Everly', 'HealthLah'],
  ['everly', 'healthlah'],
  ['Dorothy Williams', 'Mr. Tan Ah Kow'],
  ['Dorothy', 'Mr. Tan'],
  ['dorothy', 'mr-tan'],
  ['81', '67'],
  ['Toronto, ON', 'Bedok, Singapore'],
  ['"Metformin"', '"Metformin"'],
  ['"Lisinopril"', '"Amlodipine"'],
  ['"Vitamin D"', '"Insulin Glargine"'],
  ['Gardening', 'Tai Chi'],
  ['Baking', 'Reading newspapers'],
  ['Family history', 'Kopi session'],
  ['spring planting plans', 'morning tai chi routine'],
  ['tulips coming up early this year', 'weather being good for morning walks'],
  ["mother's garden in Oakville", 'old neighbourhood in Bedok'],
  ['teach the grandchildren to plant seeds', 'bring the grandchildren to the hawker centre'],
  ['from-amber-50 via-orange-50 to-rose-50', 'from-teal-50 via-cyan-50 to-emerald-50'],
  ['from-amber-400 to-orange-500', 'from-teal-400 to-teal-600'],
  ['from-orange-500 to-rose-500', 'from-teal-500 to-emerald-500'],
  ['from-orange-600 to-rose-600', 'from-teal-600 to-emerald-600'],
  ['bg-orange-200/30', 'bg-teal-200/30'],
  ['bg-rose-200/30', 'bg-emerald-200/30'],
  ['text-orange-500', 'text-teal-600'],
  ['text-orange-600', 'text-teal-700'],
  ['bg-orange-500', 'bg-teal-600'],
  ['border-orange-200', 'border-teal-200'],
  ['from-orange-50 to-rose-50', 'from-teal-50 to-emerald-50'],
  ['from-amber-50 to-orange-50', 'from-teal-50 to-cyan-50'],
  ['Collecting Memories...', 'Analyzing Health Data...'],
  ['Processing conversation with Mr. Tan', 'Processing health check-in with Mr. Tan'],
  ['loves morning calls', 'prefers morning calls in Mandarin'],
  ["talk about her garden", 'discuss his morning routine and medication'],
  ['/storybook/mr-tan', '/storybook/mr-tan'],
  ['Storybook', 'Health Log'],
  ['View Storybook', 'View Health Log'],
  ['ElderLike', 'PatientLike'],
  ['elder-dashboard-view', 'patient-dashboard-view'],
  ['import type { ElderLike }', 'import type { PatientLike }'],
  ['elderLike', 'patientLike'],
  ['ElderDashboardView', 'PatientDashboardView'],
];

for (const [from, to] of dashReplacements) {
  dashboard = dashboard.split(from).join(to);
}

// Fix the DOROTHY constant rename
dashboard = dashboard.replace(/const DOROTHY = \{/g, 'const MR_TAN = {');
dashboard = dashboard.replace(/DOROTHY\./g, 'MR_TAN.');
dashboard = dashboard.replace(/DOROTHY(?=[,\s\}\)])/g, 'MR_TAN');

// Fix the elderLike type reference
dashboard = dashboard.replace(/import type { PatientLike } from "@\/components\/vapi-call-provider"/g,
  'import type { PatientLike } from "@/components/vapi-call-provider"');

writeDst('components/dashboard.tsx', dashboard);

// ================ ELDER DASHBOARD VIEW -> PATIENT DASHBOARD VIEW ================
let elderDash = readSrc('components/elder-dashboard-view.tsx');
const elderDashReplacements = [
  ['Everly', 'HealthLah'],
  ['everly', 'healthlah'],
  ['Elder', 'Patient'],
  ['elder', 'patient'],
  ['ElderDashboardView', 'PatientDashboardView'],
  ['ElderDashboardViewProps', 'PatientDashboardViewProps'],
  ['/create-patient', '/register-patient'],
  ['Dorothy', 'Mr. Tan'],
  ['dorothy', 'mr-tan'],
  ['Toronto, ON', 'Bedok, Singapore'],
  ['America/Toronto', 'Asia/Singapore'],
  ['Gardening', 'Health'],
  ['storybook', 'storybook'],
  ['Stories captured', 'Health notes captured'],
  ['Stories captured from calls', 'Health insights from calls'],
  ['Story of the Week', 'Health Insight'],
  ['story captured', 'note captured'],
  ["Life's Simple Pleasures", 'Daily Health Check-in'],
  ['Mentioned enjoying time in the garden and checking on flowers. The tulips are starting to bloom early this year', 'Confirmed taking Metformin and Amlodipine. Reported sleeping well and feeling less dizzy this week'],
  ['the best stories are often the quiet ones', 'consistent medication adherence shows positive results'],
  ['memories captured', 'health notes captured'],
  ['memory', 'note'],
  ['memories', 'notes'],
  ['Memories', 'Health Notes'],
  ['View storybook', 'View health log'],
  ['No patient linked yet', 'No patient registered yet'],
  ['Add the person you care for', 'Register a patient'],
  ['Add patient', 'Register Patient'],
  ['Happy mood days', 'Positive mood days'],
  ['Health on track', 'Meds on track'],
  // types
  ['import type { Patient, CallLog, Memory }', 'import type { Patient, CallLog, Memory }'],
  // API paths
  ['"/api/patients"', '"/api/patients"'],
  ['"patient_id"', '"elder_id"'],
];

for (const [from, to] of elderDashReplacements) {
  elderDash = elderDash.split(from).join(to);
}

// Fix double-replacements (Patient -> Patient already correct, but elder_id in DB stays)
elderDash = elderDash.replace(/patientId/g, function(match, offset, str) {
  // Keep patientId in our code
  return 'patientId';
});

writeDst('components/patient-dashboard-view.tsx', elderDash);

// ================ ELDERS LIST -> PATIENTS LIST ================
let eldersList = readSrc('components/elders-list.tsx');
eldersList = eldersList.replace(/Elder/g, 'Patient');
eldersList = eldersList.replace(/elder/g, 'patient');
eldersList = eldersList.replace(/Everly/g, 'HealthLah');
eldersList = eldersList.replace(/everly/g, 'healthlah');
eldersList = eldersList.replace(/"\/api\/patients"/g, '"/api/patients"');
eldersList = eldersList.replace(/patient-dashboard-view/g, 'patient-dashboard-view');
eldersList = eldersList.replace(/outbound-call-dialog/g, 'outbound-call-dialog');
eldersList = eldersList.replace(/Your patients/g, 'Your patients');
eldersList = eldersList.replace(/No patients yet/g, 'No patients yet');
eldersList = eldersList.replace(/Add someone you care for to start companion calls/g, 'Register a patient to start daily health check-in calls');
eldersList = eldersList.replace(/Add patients/g, 'Register Patient');
eldersList = eldersList.replace(/onAddPatient/g, 'onAddPatient');

writeDst('components/patients-list.tsx', eldersList);

// ================ CALL DATA VIEWER ================
let callViewer = readSrc('components/call-data-viewer.tsx');
callViewer = callViewer.replace(/elder/g, 'patient');
callViewer = callViewer.replace(/Elder/g, 'Patient');
callViewer = callViewer.replace(/from-orange-100 to-rose-100/g, 'from-teal-100 to-emerald-100');
callViewer = callViewer.replace(/text-orange-500/g, 'text-teal-600');
writeDst('components/call-data-viewer.tsx', callViewer);

// ================ OUTBOUND CALL DIALOG ================
let outbound = readSrc('components/outbound-call-dialog.tsx');
outbound = outbound.replace(/Elder/g, 'Patient');
outbound = outbound.replace(/elder/g, 'patient');
outbound = outbound.replace(/Dorothy/g, 'Mr. Tan');
outbound = outbound.replace(/\+1 937 598 3675/g, '+65 9375 9836');
writeDst('components/outbound-call-dialog.tsx', outbound);

// ================ VAPI CALL PROVIDER ================
let vapi = readSrc('components/vapi-call-provider.tsx');
vapi = vapi.replace(/Elder/g, 'Patient');
vapi = vapi.replace(/elder/g, 'patient');
vapi = vapi.replace(/ElderLike/g, 'PatientLike');
vapi = vapi.replace(/elderLike/g, 'patientLike');
vapi = vapi.replace(/elderId/g, 'patientId');
vapi = vapi.replace(/elderIdRef/g, 'patientIdRef');
vapi = vapi.replace(/patient_name/g, 'patient_name');
vapi = vapi.replace(/patient_age/g, 'patient_age');
vapi = vapi.replace(/everly_analysis/g, 'healthlah_analysis');
vapi = vapi.replace(/'dorothy'/g, "'demo'");
vapi = vapi.replace(/'demo'/g, "'demo'");  // already correct
writeDst('components/vapi-call-provider.tsx', vapi);

// ================ REGISTRATION FLOW ================
let regFlow = readSrc('components/registration-flow.tsx');
regFlow = regFlow.replace(/Everly/g, 'HealthLah');
regFlow = regFlow.replace(/everly/g, 'healthlah');
regFlow = regFlow.replace(/Elder/g, 'Patient');
regFlow = regFlow.replace(/elder/g, 'patient');
regFlow = regFlow.replace(/ElderFormData/g, 'PatientFormData');
regFlow = regFlow.replace(/elderFormData/g, 'patientFormData');
regFlow = regFlow.replace(/Add patient/g, 'Patient details');
regFlow = regFlow.replace(/Sarah/g, 'Mei Ling');
regFlow = regFlow.replace(/Whitfield/g, 'Tan');
regFlow = regFlow.replace(/sarah@example\.com/g, 'meiling@example.com');
regFlow = regFlow.replace(/Dorothy/g, 'Ah Kow');
regFlow = regFlow.replace(/\+1 \(416\) 555-0199/g, '+65 8234 5678');
regFlow = regFlow.replace(/Toronto, ON/g, 'Bedok, Singapore');
regFlow = regFlow.replace(/e\.g\. Toronto, ON/g, 'e.g. Bedok, Singapore');
regFlow = regFlow.replace(/gardening, knitting, old movies/g, 'tai chi, reading newspapers, kopi');
regFlow = regFlow.replace(/Blood pressure pill/g, 'Metformin 500mg');
regFlow = regFlow.replace(/Add your patient&apos;s details/g, "Add your patient&apos;s details");
regFlow = regFlow.replace(/HealthLah will call them at this number/g, 'HealthLah will call them at this number');
regFlow = regFlow.replace(/No app or smartphone needed\. Just a regular phone call\./g, 'No app or smartphone needed. Just a regular phone call in their preferred language.');
regFlow = regFlow.replace(/Location \(city, province\/state\)/g, 'Location');
regFlow = regFlow.replace(/city, province\/state/g, 'location');

// Add language preference and conditions fields - we'll note this needs manual addition
// For now the registration flow works with the existing fields

writeDst('components/registration-flow.tsx', regFlow);

// ================ API ROUTES ================

// patients route (was elders)
let patientsRoute = readSrc('app/api/elders/route.ts');
patientsRoute = patientsRoute.replace(/elder/g, 'patient');
patientsRoute = patientsRoute.replace(/Elder/g, 'Patient');
// Keep the actual table name as "elders" since that's what's in the DB
patientsRoute = patientsRoute.replace(/\.from\("patients"\)/g, '.from("elders")');
writeDst('app/api/patients/route.ts', patientsRoute);

// patients/[id] route
let patientIdRoute = readSrc('app/api/elders/[id]/route.ts');
patientIdRoute = patientIdRoute.replace(/Elder/g, 'Patient');
patientIdRoute = patientIdRoute.replace(/elder/g, 'patient');
patientIdRoute = patientIdRoute.replace(/getPatientById/g, 'getPatientById');
writeDst('app/api/patients/[id]/route.ts', patientIdRoute);

// patients/[id]/calls route
let patientCallsRoute = readSrc('app/api/elders/[id]/calls/route.ts');
patientCallsRoute = patientCallsRoute.replace(/Elder/g, 'Patient');
patientCallsRoute = patientCallsRoute.replace(/elder/g, 'patient');
patientCallsRoute = patientCallsRoute.replace(/getCallLogsByPatientId/g, 'getCallLogsByPatientId');
writeDst('app/api/patients/[id]/calls/route.ts', patientCallsRoute);

// patients/[id]/memories route
let patientMemRoute = readSrc('app/api/elders/[id]/memories/route.ts');
patientMemRoute = patientMemRoute.replace(/Elder/g, 'Patient');
patientMemRoute = patientMemRoute.replace(/elder/g, 'patient');
patientMemRoute = patientMemRoute.replace(/getMemoriesByPatientId/g, 'getMemoriesByPatientId');
writeDst('app/api/patients/[id]/memories/route.ts', patientMemRoute);

// call route
let callRoute = readSrc('app/api/call/route.ts');
callRoute = callRoute.replace(/Elder/g, 'Patient');
callRoute = callRoute.replace(/elder/g, 'patient');
callRoute = callRoute.replace(/elderId/g, 'patientId');
callRoute = callRoute.replace(/getPatientById/g, 'getPatientById');
// Keep DB column as elder_id
callRoute = callRoute.replace(/patient_id: patientId/g, 'elder_id: patientId');
writeDst('app/api/call/route.ts', callRoute);

// call/outbound route
let outboundRoute = readSrc('app/api/call/outbound/route.ts');
outboundRoute = outboundRoute.replace(/Elder/g, 'Patient');
outboundRoute = outboundRoute.replace(/elder/g, 'patient');
outboundRoute = outboundRoute.replace(/elderId/g, 'patientId');
outboundRoute = outboundRoute.replace(/getPatientById/g, 'getPatientById');
outboundRoute = outboundRoute.replace(/logPatientId/g, 'logPatientId');
outboundRoute = outboundRoute.replace(/patient_id: logPatientId/g, 'elder_id: logPatientId');
outboundRoute = outboundRoute.replace(/patient_name/g, 'patient_name');
outboundRoute = outboundRoute.replace(/patient_age/g, 'patient_age');
writeDst('app/api/call/outbound/route.ts', outboundRoute);

// call/register route
let registerRoute = readSrc('app/api/call/register/route.ts');
registerRoute = registerRoute.replace(/Elder/g, 'Patient');
registerRoute = registerRoute.replace(/elder/g, 'patient');
registerRoute = registerRoute.replace(/elderId/g, 'patientId');
registerRoute = registerRoute.replace(/patient_id: patientId/g, 'elder_id: patientId');
writeDst('app/api/call/register/route.ts', registerRoute);

// calls/recent route
writeDst('app/api/calls/recent/route.ts', readSrc('app/api/calls/recent/route.ts'));

// webhook/vapi route
let webhookRoute = readSrc('app/api/webhook/vapi/route.ts');
webhookRoute = webhookRoute.replace(/elder/g, 'patient');
webhookRoute = webhookRoute.replace(/Elder/g, 'Patient');
// Keep DB column references
webhookRoute = webhookRoute.replace(/patient_id/g, 'elder_id');
webhookRoute = webhookRoute.replace(/"mr-tan"/g, '"demo"');
webhookRoute = webhookRoute.replace(/healthlah_analysis/g, 'healthlah_analysis');
writeDst('app/api/webhook/vapi/route.ts', webhookRoute);

// webhook-status route
writeDst('app/api/webhook-status/route.ts', readSrc('app/api/webhook-status/route.ts'));

// debug/webhook-test route
writeDst('app/api/debug/webhook-test/route.ts', readSrc('app/api/debug/webhook-test/route.ts'));

// ================ DEBUG PAGE ================
let debugPage = readSrc('app/debug/page.tsx');
debugPage = debugPage.replace(/VAPI Debug/g, 'VAPI Debug');
writeDst('app/debug/page.tsx', debugPage);

// ================ CREATE CAREGIVER PAGE ================
let caregiverPage = readSrc('app/create-caregiver/page.tsx');
caregiverPage = caregiverPage.replace(/Everly/g, 'HealthLah');
caregiverPage = caregiverPage.replace(/elder/g, 'patient');
caregiverPage = caregiverPage.replace(/Elder/g, 'Patient');
caregiverPage = caregiverPage.replace(/Create Caregiver/g, 'Create Caregiver');
caregiverPage = caregiverPage.replace(/add an patient/g, 'register a patient');
caregiverPage = caregiverPage.replace(/Add an patient/g, 'Register a patient');
caregiverPage = caregiverPage.replace(/\/create-patient/g, '/register-patient');
caregiverPage = caregiverPage.replace(/Continue to Add Patient/g, 'Continue to Register Patient');
caregiverPage = caregiverPage.replace(/\+1 555 000 0000/g, '+65 9000 0000');
writeDst('app/create-caregiver/page.tsx', caregiverPage);

// ================ STORYBOOK PAGE ================
let storybook = readSrc('app/storybook/[elderId]/page.tsx');
storybook = storybook.replace(/Elder/g, 'Patient');
storybook = storybook.replace(/elder/g, 'patient');
storybook = storybook.replace(/elderId/g, 'patientId');
storybook = storybook.replace(/Dorothy Williams/g, 'Mr. Tan Ah Kow');
storybook = storybook.replace(/Dorothy/g, 'Mr. Tan');
storybook = storybook.replace(/dorothy/g, 'mr-tan');
storybook = storybook.replace(/DOROTHY_MEMORIES/g, 'PATIENT_MEMORIES');
storybook = storybook.replace(/Living Memoir/g, 'Health Journal');
storybook = storybook.replace(/A Life in Stories/g, 'Health Journey');
storybook = storybook.replace(/Storybook/g, 'Health Log');
// Update memories content to be health-related
storybook = storybook.replace(/Oakville/g, 'Bedok');
storybook = storybook.replace(/Harold/g, 'his wife');
storybook = storybook.replace(/Toronto/g, 'Singapore');
writeDst('app/storybook/[patientId]/page.tsx', storybook);

console.log('\n=== Migration complete! ===');
