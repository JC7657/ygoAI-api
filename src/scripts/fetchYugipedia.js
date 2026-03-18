import 'dotenv/config';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const USER_AGENT = 'Yu-Gi-Oh! Card Database/1.0 (portfolio project; contact: your@email.com)';
const RATE_LIMIT_MS = 1100;

const DECKS_TO_FETCH = [
  'Branded',
  'Yummy',
  'Fire King',
  'Snake-Eye',
  'Tenpai Dragon',
  'Vanquish Soul',
  'Maliss',
  'Radiant Typhoon',
  'Mitsurugi',
  'Dragon Master',
  'Solfachord',
  'Mathmech',
  'Kashtira',
  'Mannadium',
  'Spright',
  'Tearlaments',
  'Labrynth',
  'Runick',
  'Sky Striker',
  'Mirrorjade',
];

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return null;
}

function extractSection(dom, headingText) {
  const headings = dom.window.document.querySelectorAll('h2, h3');
  for (const heading of headings) {
    const span = heading.querySelector('.mw-headline');
    if (span && span.textContent.includes(headingText)) {
      let content = '';
      let sibling = heading.nextElementSibling;
      while (sibling && !['H2', 'H3'].includes(sibling.tagName)) {
        content += sibling.textContent + '\n';
        sibling = sibling.nextElementSibling;
      }
      return content.trim();
    }
  }
  return '';
}

function extractPlayingStyle(dom) {
  const section = extractSection(dom, 'Playing style');
  if (section) return section;
  
  const paragraphs = dom.window.document.querySelectorAll('.mw-parser-output > p');
  for (const p of paragraphs) {
    const text = p.textContent;
    if (text.length > 100 && (text.includes('play') || text.includes('deck') || text.includes('archetype'))) {
      return text.trim();
    }
  }
  return '';
}

function extractCardList(dom) {
  const cards = [];
  
  const decklistSections = dom.window.document.querySelectorAll('.decklist');
  for (const section of decklistSections) {
    const links = section.querySelectorAll('a');
    for (const link of links) {
      const title = link.getAttribute('title');
      const href = link.getAttribute('href');
      if (title && !title.includes(':') && !href?.includes(':')) {
        const cardName = title.trim();
        if (cardName && cardName.length > 2 && cardName.length < 50) {
          if (!cards.includes(cardName)) {
            cards.push(cardName);
          }
        }
      }
    }
  }
  
  return cards.slice(0, 50);
}

function extractKeyCards(cards, archetype) {
  const keyCards = [];
  const lowerArchetype = archetype.toLowerCase();
  
  for (const card of cards) {
    const lowerCard = card.toLowerCase();
    if (lowerCard.includes(lowerArchetype.split(' ')[0].toLowerCase()) ||
        lowerCard.includes('mirrorjade') ||
        lowerCard.includes('albion') ||
        lowerCard.includes('albaz') ||
        lowerCard.includes('fallen') ||
        lowerCard.includes('dogmatika') ||
        lowerCard.includes('despia') ||
        lowerCard.includes('bystial')) {
      keyCards.push(card);
    }
  }
  
  return keyCards.slice(0, 8);
}

async function fetchArchetypeInfo(archetype) {
  console.log(`Fetching ${archetype}...`);
  
  const url = `https://yugipedia.com/api.php?action=parse&page=${encodeURIComponent(archetype)}&prop=text&format=json`;
  const data = await fetchWithRetry(url);
  
  if (!data) {
    console.log(`Failed to fetch ${archetype}`);
    return null;
  }
  
  const dom = new JSDOM(data.parse.text['*']);
  const playingStyle = extractPlayingStyle(dom);
  const cards = extractCardList(dom);
  const keyCards = extractKeyCards(cards, archetype);
  
  return {
    name: archetype,
    playingStyle: playingStyle.substring(0, 1000),
    keyCards,
    allCards: cards,
  };
}

async function main() {
  console.log('Starting Yugipedia ingestion...\n');
  
  const archetypes = [];
  
  for (const archetype of DECKS_TO_FETCH) {
    const info = await fetchArchetypeInfo(archetype);
    if (info) {
      archetypes.push(info);
    }
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
  }
  
  const output = {
    updatedAt: new Date().toISOString(),
    archetypes: archetypes.filter(a => a !== null),
  };
  
  const outputPath = path.join(process.cwd(), 'src', 'data', 'yugipedia.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✓ Saved ${archetypes.length} archetypes to ${outputPath}`);
  
  console.log('\nArchetypes fetched:');
  for (const a of output.archetypes) {
    console.log(`  - ${a.name}: ${a.keyCards.length} key cards, ${a.allCards.length} total cards`);
  }
}

main().catch(console.error);
