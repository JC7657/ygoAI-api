import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_FILE = path.join(__dirname, '../data/yugipediaKnowledge.json');

const USER_AGENT = 'YGO-Card-Database/1.0 (contact@example.com)';
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FETCH_DELAY_MS = 1500;

const META_ARCHETYPES = [
  'Dracotail',
  'Yummy',
  'Radiant Typhoon',
  'Vanquish Soul',
  'Maliss',
  'Branded',
  'Mitsurugi'
];

const STAPLE_CARDS = [
  'Ash Blossom & Joyous Spring',
  'S:P Little Knight',
  'Mulcharmy Fuwalos',
  'Called by the Grave',
  'Infinite Impermanence',
  'Super Starslayer TY-PHON - Sky Crisis',
  'Forbidden Droplet',
  'Ghost Belle & Haunted Mansion',
  'Triple Tactics Talent',
  'Droll & Lock Bird',
  'Nibiru, the Primal Being',
  'I:P Masquerena',
  'Mulcharmy Purulia',
  'Effect Veiler',
  'Pot of Prosperity',
  'Divine Arsenal AA-ZEUS - Sky Thunder',
  'Bystial Magnamhut',
  'Salamangreat Almiraj',
  'Dimension Shifter',
  'Dominus Impulse',
  'Accesscode Talker',
  'Number 41: Bagooska the Terribly Tired Tapir'
];

function loadKB() {
  try {
    if (fs.existsSync(KB_FILE)) {
      return JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading KB:', err.message);
  }
  return { archetypes: {}, cards: {}, updatedAt: null };
}

function saveKB(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(KB_FILE, JSON.stringify(data, null, 2));
  console.log('KB saved to disk');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractText(html, startTag, endTag) {
  const match = html.match(new RegExp(startTag + '([\\s\\S]*?)' + endTag, 'i'));
  return match ? match[1].trim() : null;
}

function extractListItems(html, headerPattern) {
  const items = [];
  const headerMatch = html.match(new RegExp(`<h[^>]*>.*?${headerPattern}.*?</h[^>]*>([\\s\\S]*?)(?=<h|$)`, 'i'));
  if (!headerMatch) return items;
  
  const section = headerMatch[1];
  const ddMatches = section.matchAll(/<dd>([\\s\\S]*?)<\/dd>/g);
  for (const match of ddMatches) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text) items.push(text);
  }
  return items;
}

async function fetchPage(title) {
  const url = `https://yugipedia.com/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.parse?.text?.['*'] || '';
}

function extractPlayingStyle(html) {
  const match = html.match(/id="Playing_style"[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (match && match[1]) {
    return match[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
  }
  const altMatch = html.match(/id="Playing-style"[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (altMatch && altMatch[1]) {
    return altMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
  }
  return '';
}

const NON_CARD_TERMS = [
  'Main Deck', 'Extra Deck', 'Monster Card', 'Effect Monster', 'Normal Monster',
  'Spell Card', 'Trap Card', 'OCG', 'Traditional Format', 'Tuner monster',
  'Equip Spell', 'Field Spell', 'Continuous Spell', 'Quick-Play Spell',
  'Normal Trap', 'Counter Trap', 'Continuous Trap', 'Normal Spell',
  'Fusion Monster', 'Synchro Monster', 'Xyz Monster', 'Link Monster',
  'Ritual Monster', 'Pendulum Monster', 'Spirit Monster', 'Union Monster',
  'Toon Monster', 'Gemini Monster'
];

function isValidCardName(name) {
  if (!name || name.length < 3) return false;
  const lower = name.toLowerCase();
  if (NON_CARD_TERMS.some(term => lower === term.toLowerCase())) return false;
  if (lower.includes('main_deck') || lower.includes('extra_deck')) return false;
  if (lower.includes('card')) return false;
  return true;
}

function extractAllCards(html) {
  const cards = [];
  
  const decklistMatch = html.match(/class="decklist[\s\S]*?<\/ul>/i);
  if (decklistMatch) {
    const links = decklistMatch[0].matchAll(/<a[^>]*title="([^"]+)"[^>]*>/gi);
    for (const link of links) {
      if (isValidCardName(link[1])) {
        cards.push(link[1]);
      }
    }
  }
  return cards;
}

function extractDeckByType(html, type) {
  const cards = [];
  const typeRegex = new RegExp(`<div[^>]*class="decklist-group-heading"[^>]*>.*?${type}.*?<\\/div>[\\s\\S]*?<ul>([\\s\\S]*?)<\\/ul>`, 'i');
  const sectionMatch = html.match(typeRegex);
  
  if (sectionMatch && sectionMatch[1]) {
    const links = sectionMatch[1].matchAll(/<a[^>]*title="([^"]+)"[^>]*>/gi);
    for (const link of links) {
      if (isValidCardName(link[1])) {
        cards.push(link[1]);
      }
    }
  }
  return cards;
}

function parseArchetypePage(html, title) {
  const result = { 
    name: title, 
    playing_style: '', 
    recommended_cards: { main: [], extra: [] } 
  };
  
  result.playing_style = extractPlayingStyle(html);
  
  const allCards = extractAllCards(html);
  
  const mainCards = extractDeckByType(html, 'Main Deck');
  const extraCards = extractDeckByType(html, 'Extra Deck');
  
  result.recommended_cards.main = [...new Set([...mainCards, ...allCards])].slice(0, 20);
  result.recommended_cards.extra = [...new Set(extraCards)].slice(0, 15);
  
  return result;
}

function extractCardEffect(html) {
  const effectMatch = html.match(/<td[^>]*class="cardtable-cell"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (effectMatch && effectMatch[1]) {
    return effectMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 800);
  }
  const altMatch = html.match(/<div[^>]*class="card-text"[^>]*>([\s\S]*?)<\/div>/i);
  if (altMatch && altMatch[1]) {
    return altMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 800);
  }
  return '';
}

function parseCardPage(html, title) {
  const result = {
    name: title,
    effect: extractCardEffect(html),
    mentions: [],
    supports: [],
    archetypes: [],
    related_archetypes: [],
    actions: [],
    summoning: [],
    miscellaneous: []
  };
  
  result.mentions = extractListItems(html, 'Mentions');
  result.supports = extractListItems(html, 'Supports');
  result.archetypes = extractListItems(html, 'Archetypes and series');
  result.related_archetypes = extractListItems(html, 'Related to.*archetypes');
  result.actions = extractListItems(html, 'Actions');
  result.summoning = extractListItems(html, 'Summoning');
  result.miscellaneous = extractListItems(html, 'Miscellaneous');
  
  return result;
}

export function isCacheStale(entry) {
  if (!entry?.cachedAt) return true;
  return Date.now() - new Date(entry.cachedAt).getTime() > CACHE_DURATION_MS;
}

export async function fetchAndParseFromYugipedia(title) {
  console.log(`Fetching: ${title}`);
  await sleep(FETCH_DELAY_MS);
  
  const html = await fetchPage(title);
  if (!html) {
    throw new Error('Empty response');
  }
  
  const hasPlayingStyle = html.includes('id="Playing_style"') || html.includes('id="Playing-style"');
  
  if (hasPlayingStyle) {
    return { type: 'archetype', data: parseArchetypePage(html, title) };
  } else {
    return { type: 'card', data: parseCardPage(html, title) };
  }
}

export function getFromKB(title) {
  const kb = loadKB();
  
  if (kb.archetypes[title] || kb.cards[title]) {
    return kb.archetypes[title] || kb.cards[title];
  }
  
  const lowerTitle = title.toLowerCase();
  for (const [key, value] of Object.entries(kb.archetypes || {})) {
    if (key.toLowerCase() === lowerTitle) return value;
  }
  for (const [key, value] of Object.entries(kb.cards || {})) {
    if (key.toLowerCase() === lowerTitle) return value;
  }
  
  return null;
}

export function saveToKB(title, entry) {
  const kb = loadKB();
  entry.cachedAt = new Date().toISOString();
  
  if (entry.type === 'archetype' || entry.playing_style) {
    kb.archetypes[title] = entry;
  } else {
    kb.cards[title] = entry;
  }
  
  saveKB(kb);
}

export async function getOrFetchFromYugipedia(title) {
  const cached = getFromKB(title);
  
  if (cached && !isCacheStale(cached)) {
    console.log(`Using cached: ${title}`);
    return cached;
  }
  
  if (cached) {
    console.log(`Cache stale, re-fetching: ${title}`);
  }
  
  try {
    const { type, data } = await fetchAndParseFromYugipedia(title);
    const entry = { ...data, type };
    saveToKB(title, entry);
    return entry;
  } catch (err) {
    console.error(`Error fetching ${title}:`, err.message);
    return cached;
  }
}

export async function prePopulate() {
  console.log('Starting pre-population...');
  const kb = loadKB();
  let failed = [];
  
  console.log('\n--- Fetching Meta Archetypes ---');
  for (const archetype of META_ARCHETYPES) {
    try {
      const { type, data } = await fetchAndParseFromYugipedia(archetype);
      const entry = { ...data, type };
      kb.archetypes[archetype] = entry;
      kb.archetypes[archetype].cachedAt = new Date().toISOString();
      saveKB(kb);
      console.log(`✓ ${archetype}`);
    } catch (err) {
      console.error(`✗ ${archetype}: ${err.message}`);
      failed.push(archetype);
    }
  }
  
  console.log('\n--- Fetching Staple Cards ---');
  for (const card of STAPLE_CARDS) {
    try {
      const { type, data } = await fetchAndParseFromYugipedia(card);
      const entry = { ...data, type };
      kb.cards[card] = entry;
      kb.cards[card].cachedAt = new Date().toISOString();
      saveKB(kb);
      console.log(`✓ ${card}`);
    } catch (err) {
      console.error(`✗ ${card}: ${err.message}`);
      failed.push(card);
    }
  }
  
  console.log('\n--- Complete ---');
  console.log(`Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(failed.join(', '));
  }
}

export default {
  getOrFetchFromYugipedia,
  getFromKB,
  isCacheStale,
  prePopulate,
  META_ARCHETYPES,
  STAPLE_CARDS
};
