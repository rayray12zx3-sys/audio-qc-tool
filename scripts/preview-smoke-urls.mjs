const baseUrl = 'http://127.0.0.1:8123/';

const states = [
  ['Empty', baseUrl, 'No uploaded track results; mix empty state visible; copy report disabled.'],
  ['Voice result', `${baseUrl}?preview=voice`, 'Voice tab active; voice result visible; copy report enabled.'],
  ['BGM result', `${baseUrl}?preview=bgm`, 'BGM tab active; preview-bgm.wav visible; copy report enabled.'],
  ['Both results', `${baseUrl}?preview=both`, 'Voice and BGM data present; mix section visible; copy report enabled.'],
  ['Voice error', `${baseUrl}?preview=error-voice`, 'Voice tab active; error state visible; copy report disabled.'],
  ['BGM error', `${baseUrl}?preview=error-bgm`, 'BGM tab active; error state visible; copy report disabled.'],
  ['Loading', `${baseUrl}?preview=loading`, 'Loading overlay visible; no completed report treated as ready.']
];

console.log('Manual preview smoke check');
console.log('');
console.log('Start server first:');
console.log('  npm run serve');
console.log('');
console.log('Recommended mobile viewport: 390x844');
console.log('');
console.log('Preview URLs:');

for (const [label, url, expected] of states) {
  console.log(`- ${label}: ${url}`);
  console.log(`  Check: ${expected}`);
}

console.log('');
console.log('This command only lists manual check targets. It does not automate browser UI verification.');
