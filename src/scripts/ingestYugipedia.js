import { prePopulate } from '../lib/yugipedia.js';

console.log('Starting Yu-Gi-Oh! knowledge base pre-population...');
console.log('This will fetch ~30 pages from Yugipedia.');
console.log('Estimated time: ~45 seconds.\n');

await prePopulate();

console.log('\nDone! Run the server to test the AI.');
