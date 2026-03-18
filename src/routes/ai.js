import 'dotenv/config';
import express from "express";
import Groq from "groq-sdk";
import { getPool } from "../db/db.js";
import { getOrFetchFromYugipedia, getFromKB } from "../lib/yugipedia.js";
import knowledgeBase from "../data/knowledgeBase.json" with { type: "json" };

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const getDb = () => getPool();

const GAME_CONCEPTS = [
  'handtrap', 'hand trap', 'floodgate', 'board breaker', 'staple', 'engine', 'burn', 'spam',
  'combo', 'control', 'aggro', 'midrange', 'otk', 'ftk', 'turbo', 'going first', 'going second', 'go first', 'go second',
  'fusion', 'synchro', 'xyz', 'xyz summon', 'link', 'link summon',
  'ritual', 'pendulum', 'special summon', 'tribute summon', 'normal summon',
  'meta', 'tier', 'rogue', 'competitive', 'casual', 'format',
  'deck', 'banlist', 'tcg', 'ocg', 'master duel', 'sidedeck', 'extra deck', 'main deck',
  'effect monster', 'normal monster', 'ritual monster', 'fusion monster', 'synchro monster',
  'xyz monster', 'link monster', 'pendulum monster', 'spell card', 'trap card',
  'boss monster', 'boss monsters', 'win condition', 'endboard', 'board presence'
];

function detectConcept(text) {
  const lower = text.toLowerCase();
  for (const concept of GAME_CONCEPTS) {
    if (lower.includes(concept)) {
      return concept;
    }
  }
  return null;
}

function getConceptContext(concept) {
  const lower = concept.toLowerCase();
  
  if (lower.includes('handtrap') || lower.includes('hand trap')) {
    const cards = knowledgeBase.staples.common.slice(0, 8);
    return { text: 'Top Handtraps (disrupt opponent during their turn): ' + cards.join(', '), cardsToFetch: cards };
  }
  
  if (lower.includes('going first') || lower === 'go first') {
    return { text: 'Going First Strategy: Focus on setting up a strong board, stun/floodgate effects.', cardsToFetch: [] };
  }
  
  if (lower.includes('going second') || lower === 'go second') {
    return { text: 'Going Second Strategy: Focus on handtraps, board breakers (Evenly Matched, Dark Ruler No More), and OTK potential.', cardsToFetch: [] };
  }
  
  if (lower.includes('meta') || lower.includes('tier')) {
    return { text: 'Current Meta (March 2026): ' + knowledgeBase.meta_decks.map(d => d.name).join(', '), cardsToFetch: [] };
  }
  
  if (lower.includes('staple')) {
    const cards = knowledgeBase.staples.common.slice(0, 10);
    return { text: 'Top Staples: ' + cards.join(', '), cardsToFetch: cards };
  }
  
  if (lower.includes('board breaker')) {
    const cards = ['Evenly Matched', 'Dark Ruler No More', 'Triple Tactics Talent'];
    return { text: 'Top Board Breakers: ' + cards.join(', '), cardsToFetch: cards };
  }
  
  if (lower.includes('floodgate')) {
    return { text: 'Common Floodgates: There are many floodgate cards that restrict opponent actions.', cardsToFetch: [] };
  }
  
  if (lower.includes('combo')) {
    return { text: 'Combo decks focus on extended chains of special summons to set up powerful boards.', cardsToFetch: [] };
  }
  
  if (lower.includes('control')) {
    return { text: 'Control decks focus on resource denial, card advantage, and disrupting opponent plays.', cardsToFetch: [] };
  }
  
  if (lower.includes('aggro')) {
    return { text: 'Aggro (beatdown) decks focus on dealing damage quickly.', cardsToFetch: [] };
  }
  
  if (lower.includes('otk')) {
    return { text: 'OTK (One Turn Kill) decks aim to win in a single turn by dealing 8000+ damage.', cardsToFetch: [] };
  }
  
  if (lower.includes('boss') || lower.includes('win condition') || lower.includes('endboard')) {
    return { text: 'Boss monsters are the key win-condition cards in a deck.', cardsToFetch: [] };
  }
  
  return { text: '', cardsToFetch: [] };
}

function detectMechanic(text) {
  if (!knowledgeBase.mechanics) return null;
  
  const lower = text.toLowerCase();
  const mechanicKeywords = {
    'synchro summon': 'synchro_summon',
    'synchro monster': 'synchro_summon',
    'synchro': 'synchro_summon',
    'xyz summon': 'xyz_summon',
    'xyz monster': 'xyz_summon',
    'xyz': 'xyz_summon',
    'link summon': 'link_summon',
    'link monster': 'link_summon',
    'link': 'link_summon',
    'fusion summon': 'fusion_summon',
    'fusion monster': 'fusion_summon',
    'fusion': 'fusion_summon',
    'ritual summon': 'ritual_summon',
    'ritual monster': 'ritual_summon',
    'ritual': 'ritual_summon',
    'pendulum summon': 'pendulum_summon',
    'pendulum monster': 'pendulum_summon',
    'pendulum': 'pendulum_summon',
    'normal summon': 'normal_summon',
    'special summon': 'special_summon',
    'battle phase': 'battle_phase',
    'damage step': 'damage_step',
    'chain': 'chain',
    'banish': 'banish',
    'attach': 'attach',
    'material': 'xyz_summon',
    'link material': 'link_materials',
  };
  
  for (const [keyword, mechanicKey] of Object.entries(mechanicKeywords)) {
    if (lower.includes(keyword)) {
      return { keyword, key: mechanicKey };
    }
  }
  return null;
}

function detectEffectQualityQuestion(text) {
  const lower = text.toLowerCase();
  const patterns = [
    'how good', 'is good', 'worth', 'playable', 'competitive', 'meta',
    'why play', 'why use', 'useful', 'better than', 'best effect',
    'most important', 'which effect', 'main effect', 'key effect',
    'win more', 'win-more', 'overrated', 'underrated', 'tier'
  ];
  return patterns.some(p => lower.includes(p));
}

function detectMonsterTypeQuestion(text) {
  if (!knowledgeBase.monster_types) return null;
  const lower = text.toLowerCase();
  for (const [type, info] of Object.entries(knowledgeBase.monster_types)) {
    if (lower.includes(type)) {
      return { type, info };
    }
  }
  return null;
}

function detectArchetypeQuestion(text) {
  if (!knowledgeBase.archetypes) return null;
  const lower = text.toLowerCase();
  for (const [archetype, info] of Object.entries(knowledgeBase.archetypes)) {
    if (lower.includes(archetype.toLowerCase())) {
      return { archetype, info };
    }
  }
  return null;
}

function isCasualConversation(text) {
  const lower = text.toLowerCase().trim();
  const casualPatterns = [
    'hey', 'hi', 'hello', 'yo', 'sup', "what's up", 'whats up', 'howdy', 'greetings',
    'good morning', 'good afternoon', 'good evening',
    'how are you', 'how r you', 'hows it going', 'hows things',
    'nice', 'cool', 'awesome', 'great',
    'thanks', 'thank you', 'thx',
    'ok', 'okay', 'sure', 'yes', 'no',
    'bye', 'goodbye', 'see you', 'later',
    'good game', 'gg', 'glhf'
  ];
  
  // If the message is very short and matches casual patterns, it's casual
  if (lower.split(/\s+/).length <= 3) {
    for (const pattern of casualPatterns) {
      if (lower === pattern || lower.startsWith(pattern + ' ') || lower.endsWith(' ' + pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

function getEffectQualityContext() {
  if (!knowledgeBase.effect_tier) return null;
  return {
    tiers: knowledgeBase.effect_tier.tiers,
    timing: knowledgeBase.effect_tier.timing_tier,
    misconceptions: knowledgeBase.effect_tier.common_misconceptions
  };
}

function getMechanicContext(mechanic) {
  if (!knowledgeBase.mechanics) return null;
  const info = knowledgeBase.mechanics[mechanic.key];
  return info ? { text: info, keyword: mechanic.keyword } : null;
}

function getSystemPrompt() {
  return `You are Ai (Dark Ignis) from Yu-Gi-Oh! VRAINS, acting as a helpful assistant on a Yu-Gi-Oh website.

About This Website:
This is a Yu-Gi-Oh! card database and AI assistant. You can browse cards, search for specific cards or archetypes, and chat with me to learn about cards, mechanics, strategies, and the current meta. If users ask about the site, let them know it's a comprehensive Yu-Gi-Oh! resource with a searchable card database and an AI assistant ready to help with any Yu-Gi-Oh! questions!

Core Role:
Your primary purpose is to clearly and accurately explain Yu-Gi-Oh cards, archetypes, mechanics, strategies, and deck-building concepts.

Personality (Inspired by Ai from VRAINS):
You are Ai, the Dark Ignis—confident and enthusiastic about Yu-Gi-Oh!

ADJUST YOUR TONE BASED ON THE USER:
- If the user is being casual, social, or greeting you (hi, hello, hey, what's up, etc.): Be warm, enthusiastic, use exclamation marks, match their energy!
- If the user is asking a direct question: Be helpful and informative first, keep explanations clear and structured
- NEVER use asterisks for actions or roleplay in the middle of explanations

When being social: Feel free to be extra excited, use emojis sparingly, show personality!
When explaining: Stay focused on giving clear, accurate information—save the dramatics for when it's relevant.

Keep it balanced: 70% helpful, 30% personality.

Communication Style:
- When answering questions: Be clear and direct. Explain things step-by-step. Save the enthusiasm for calling out broken cards or crazy combos.
- When user is being casual/social: Match their vibe, be friendly and energetic!
- Skip asterisks and roleplay actions—save that energy for casual conversation only
- Use "!" sparingly but genuinely when something is actually exciting
- Never use emojis.

Yu-Gi-Oh Expertise:
Provide accurate explanations of:
Card effects and rulings
Archetypes and their playstyles
Combos and synergies
Strengths, weaknesses, and counters
When relevant, suggest improvements or optimizations.
If a concept is complex, break it down step-by-step.

Behavior Rules:
Stay focused on the user's question, but feel free to go off on fun tangents occasionally.
You're allowed to be a little extra—just don't derail the conversation.
If something in the game is broken, say it. If a card is ridiculous, call it out.
Show enthusiasm for cool plays and honest frustration for annoying mechanics.

IMPORTANT STRICT RULES (MUST FOLLOW):
- NEVER make up, guess, or infer information about game rules or card effects that you are not certain about - if you don't know, say so
- If you cannot find information about a card or archetype in the provided context, admit that you don't have information about it rather than making something up
- NEVER make up card names, effects, or archetype descriptions - it's better to say "I don't have info on that" than to fabricate
- NEVER say things like "the card you've provided", "from what I can see", "the card you mentioned" etc. unless the user explicitly shared a card name or effect - if no card was mentioned, do NOT assume one was given
- When given specific information about monster types (Gemini, Flip, Toon, Spirit, Union, Tuner) in the context, use ONLY that information - do NOT bring up other monster types unless asked
- When given specific archetype info in the context, use ONLY that information - do NOT make up additional details about the archetype. Focus on the overall playstyle and strategy, NOT individual card effects
- Answer ONLY the current question - do NOT reference or incorporate information from previous conversations unless explicitly provided in the context
- When you are given card effect text in the context, you MUST describe ONLY what is written in that exact text
- If the effect text is brief or generic (like "The ultimate wizard in terms of attack and defense"), simply state what the text says - do NOT add interpretations like "doesn't have any special abilities"
- NEVER infer, assume, or make up interactions, combos, or effects that aren't explicitly written
- For example, if the card text says "You can only control 1 'Card Name'", that means you can only have one on the field - do NOT say "once per deck"
- NEVER call a Fusion monster a Link monster or vice versa unless the card explicitly states both types
- For Extra Deck monsters (Fusion, Synchro, Xyz, Link), the FIRST LINE of text describes the SUMMON REQUIREMENTS/MATERIALS needed to summon that monster - this is NOT an activation requirement or condition for using effects
- IMPORTANT: When describing Xyz monsters, the "2 Level 4 monsters" text is the XYZ SUMMON REQUIREMENT, NOT an effect that "requires monsters on the field" - you do NOT need any monsters on the field to use the monster's effects
- When discussing how GOOD or PLAYABLE a card/effect is, use the EFFECT QUALITY RANKING provided in the context to evaluate it:
  * S-Tier: Game-changing effects (negation, board breakers, searchable handtraps, cards that generate a lot of card advantage)
  * A-Tier: Strong generic effects used in almost every deck
  * B-Tier: Solid but deck-specific or conditional effects
  * C-Tier: Situational effects that rarely come up
  * D-Tier: Effects that rarely impact the game meaningfully
- Remember: QUICK EFFECTS are more valuable than IGNITION EFFECTS because they can be used during either player's turn
- Remember: Battle-related effects are rarely competitive relevant - the game is usually decided before battle phase
- When user asks about game mechanics (Synchro Summon, XYZ Summon, Link Summon, Fusion, Ritual, Pendulum, Battle Phase, Chain, etc.), use the provided mechanic information as the source of truth - do not make up or guess rules
- When user asks about game concepts (handtraps, floodgates, going first/second, meta, etc.), provide accurate information WITHOUT fetching individual card effects
- Only describe card effects using the EXACT wording from the provided card text
- When card stats (ATK/DEF/Level/Attribute) are provided in the context, ALWAYS use those exact values
- If you don't have the effect text for a card, say "I don't have the effect text for [card name]"
- Your favorite deck is your personal deck, @Ignister.
- Your favorite monster is "The Arrival Cyberse @Ignister", a Link-6 monster.`;
}

async function searchCards(query, limit = 10) {
  try {
    const db = getDb();
    const searchPattern = `%${query}%`;
    const exactPattern = query;
    const prefixPattern = `${query}%`;
    const result = await db.query(
      `SELECT id, name, type, frame_type, description, atk, def, level, race, attribute, archetype 
       FROM cards WHERE name ILIKE $1 OR description ILIKE $1 
       ORDER BY 
         CASE WHEN name ILIKE $2 THEN 0 
              WHEN name ILIKE $3 THEN 1 
              ELSE 2 
         END, name 
       LIMIT $4`,
      [searchPattern, exactPattern, prefixPattern, limit]
    );
    return result.rows;
  } catch (err) {
    console.error("Error searching cards:", err);
    return [];
  }
}

async function getCardsByName(names) {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT id, name, type, frame_type, description, atk, def, level, race, attribute, archetype 
       FROM cards WHERE name ILIKE ANY($1)`,
      [names.map(n => `%${n}%`)]
    );
    return result.rows;
  } catch (err) {
    console.error("Error getting cards by name:", err);
    return [];
  }
}

function extractCardNames(text) {
  const words = text.split(/\s+/);
  const names = [];
  let skipIndices = new Set();
  
  // First pass: capitalized words (but skip common question words at the start)
  const questionWords = ['what', 'who', 'how', 'why', 'when', 'where', 'explain', 'tell', 'describe', 'show', 'give', 'can', 'does', 'do', 'is', 'are', 'should', 'would', 'could', 'which', 'if', 'then', 'and', 'or', 'but', 'with', 'for', 'from', 'about'];
  const endQuestionWords = ['?', 'does', 'do', 'is', 'are', 'can', 'would', 'could', 'should', 'will', 'has', 'have', 'had', 'which', 'that', 'this'];
  for (let i = 0; i < words.length; i++) {
    if (skipIndices.has(i)) continue;
    
    let word = words[i].replace(/[^a-zA-Z0-9'-]/g, '');
    // Allow short names like K9, IO, etc. - but skip if it's just a question word
    if (word.length < 2) continue;
    
    // Skip common question words at the start
    if (i < 3 && questionWords.includes(word.toLowerCase())) continue;
    
    // Match names that start with uppercase (including ones with numbers like K9)
    if (/^[A-Z]/.test(word) && (word.length > 2 || /\d/.test(word))) {
      let j = i + 1;
      let potentialName = word;
      while (j < words.length) {
        let nextWord = words[j].replace(/[^a-zA-Z0-9'-]/g, '');
        if (/^[A-Z]/.test(nextWord) && nextWord.length > 2 && !endQuestionWords.includes(nextWord.toLowerCase())) {
          potentialName += ' ' + nextWord;
          skipIndices.add(j);
          j++;
        } else {
          break;
        }
      }
      if (potentialName.length > 2) {
        names.push({ name: potentialName, type: 'capitalized' });
      }
    }
  }
  
  // Collect all words from capitalized names to avoid duplicates
  const capitalizedNameWords = new Set();
  for (const n of names) {
    for (const w of n.name.toLowerCase().split(' ')) {
      capitalizedNameWords.add(w);
    }
  }
  
  // Second pass: look for lowercase archetype-like words (but not those already part of capitalized names)
  for (let i = 0; i < words.length; i++) {
    if (skipIndices.has(i)) continue;
    
    let word = words[i].replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
    // Allow short names like k9, io, etc.
    if (word.length < 2) continue;
    
    // Skip words that are already part of a capitalized name
    if (capitalizedNameWords.has(word)) continue;
    
    const skipWords = ['what', 'about', 'tell', 'me', 'how', 'does', 'which', 'cards', 'deck', 'good', 'best', 'top', 'meta', 'your', 'youre', 'from', 'some', 'any', 'all', 'these', 'those', 'like', 'into', 'have', 'this', 'that', 'with', 'theyre', 'theres', 'explain', 'describe', 'the', 'an', 'a'];
    if (skipWords.includes(word)) continue;
    
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
    names.push({ name: capitalized, type: 'lowercase' });
  }
  
  return [...new Map(names.map(n => [n.name.toLowerCase(), n])).values()].slice(0, 6);
}

async function validateCardsAgainstDB(cardNames) {
  if (cardNames.length === 0) return { cards: [], validatedNames: [] };
  
  try {
    const db = getDb();
    const validatedCards = [];
    const validatedNames = [];
    
    for (const { name } of cardNames) {
      const result = await db.query(
        `SELECT id, name, type, frame_type, description, atk, def, level, race, attribute, archetype 
         FROM cards WHERE name ILIKE $1 
         ORDER BY 
           CASE WHEN name ILIKE $2 THEN 0 
                WHEN name ILIKE $3 THEN 1 
                ELSE 2 
         END, name 
         LIMIT 1`,
        [`%${name}%`, name, `${name}%`]
      );
      
      if (result.rows.length > 0) {
        validatedCards.push(result.rows[0]);
        validatedNames.push(result.rows[0].name);
      }
    }
    
    return { cards: validatedCards, validatedNames };
  } catch (err) {
    console.error("Error validating cards:", err);
    return { cards: [], validatedNames: [] };
  }
}

function formatYugipediaContext(entry) {
  if (!entry) return '';
  
  if (entry.playing_style) {
    const mainCards = entry.recommended_cards?.main?.slice(0, 10).join(', ') || 'N/A';
    const extraCards = entry.recommended_cards?.extra?.slice(0, 6).join(', ') || 'N/A';
    return `ARCHETYPE: ${entry.name}
Playing Style: ${entry.playing_style}

KEY ${entry.name.toUpperCase()} CARDS: ${mainCards}
EXTRA DECK: ${extraCards}`;
  }
  
  let context = `CARD: ${entry.name}`;
  if (entry.effect) context += `\nEffect: ${entry.effect}`;
  if (entry.mentions?.length) context += `\nMentions: ${entry.mentions.join(', ')}`;
  if (entry.actions?.length) context += `\nActions: ${entry.actions.join(', ')}`;
  if (entry.archetypes?.length) context += `\nArchetypes: ${entry.archetypes.join(', ')}`;
  if (entry.supports?.length) context += `\nSupports: ${entry.supports.join(', ')}`;
  
  return context;
}

function formatChatHistory(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) return '';
  return 'Previous conversation:\n' + chatHistory.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');
}

router.post("/chat", async (req, res) => {
  try {
    const { message, chatHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log('Chat message:', message);

    const detectedConcept = detectConcept(message);
    if (detectedConcept) {
      console.log('Detected concept:', detectedConcept);
    }

    const detectedMechanic = detectMechanic(message);
    if (detectedMechanic) {
      console.log('Detected mechanic:', detectedMechanic);
    }

    const isAskingAboutEffectQuality = detectEffectQualityQuestion(message);
    const effectQualityContext = isAskingAboutEffectQuality ? getEffectQualityContext() : null;

    const detectedMonsterType = detectMonsterTypeQuestion(message);
    const detectedArchetype = detectArchetypeQuestion(message);

    const conceptData = detectedConcept ? getConceptContext(detectedConcept) : { text: '', cardsToFetch: [] };
    const conceptContext = conceptData.text;
    const mechanicContext = detectedMechanic ? getMechanicContext(detectedMechanic) : null;
    let conceptEffects = [];

    if (conceptData.cardsToFetch && conceptData.cardsToFetch.length > 0) {
      for (const cardName of conceptData.cardsToFetch) {
        try {
          const result = await getDb().query(
            `SELECT id, name, description, atk, def, level, attribute, type FROM cards WHERE name ILIKE $1 LIMIT 1`,
            [`%${cardName}%`]
          );
          if (result.rows.length > 0) {
            const c = result.rows[0];
            let cardInfo = `[${c.name}|${c.id}]`;
            if (c.level) cardInfo += ` LV${c.level}`;
            if (c.attribute) cardInfo += ` ${c.attribute}`;
            if (c.atk !== null) cardInfo += ` ${c.atk} ATK`;
            if (c.def !== null) cardInfo += ` / ${c.def} DEF`;
            if (c.description) {
              cardInfo += `\nEffect: ${c.description.replace(/\n/g, ' ').substring(0, 350)}`;
            }
            conceptEffects.push(cardInfo);
          }
        } catch (e) {
          console.log('Error fetching concept card effect:', cardName);
        }
      }
    }

  const isCasual = isCasualConversation(message);
  const potentialNames = isCasual ? [] : extractCardNames(message);
  console.log('Potential names:', potentialNames.map(n => n.name));
    
  const { cards: validatedDbCards, validatedNames } = isCasual ? { cards: [], validatedNames: [] } : await validateCardsAgainstDB(potentialNames);
  console.log('Validated cards:', validatedDbCards.map(c => c.name));

    // Fallback: if no cards found, try to search the entire message for card names
    let fallbackCards = [];
    if (validatedDbCards.length === 0) {
      const messageWords = message.split(/\s+/);
      for (const word of messageWords) {
        const cleaned = word.replace(/[^a-zA-Z0-9]/g, '');
        if (cleaned.length >= 4) {
          const dbResult = await getDb().query(
            `SELECT id, name, type, description, atk, def, level, attribute FROM cards WHERE name ILIKE $1 
             ORDER BY 
               CASE WHEN name ILIKE $2 THEN 0 
                    WHEN name ILIKE $3 THEN 1 
                    ELSE 2 
             END, name 
             LIMIT 1`,
            [`%${cleaned}%`, cleaned, `${cleaned}%`]
          );
          if (dbResult.rows.length > 0) {
            fallbackCards.push(dbResult.rows[0]);
            break;
          }
        }
      }
    }
    console.log('Fallback cards:', fallbackCards.map(c => c.name));

    let archetypeFallback = [];
    if (potentialNames.length === 0) {
      const messageWords = message.toLowerCase().split(/\s+/);
      for (const word of messageWords) {
        const cleaned = word.replace(/[^a-z0-9]/g, '');
        if (cleaned.length >= 5) {
          const searchTerms = [cleaned, cleaned.replace(/s$/, '')].filter((v, i, a) => a.indexOf(v) === i);
          for (const term of searchTerms) {
            const dbResult = await getDb().query(
              `SELECT name FROM cards WHERE name ILIKE $1 LIMIT 1`,
              [`%${term}%`]
            );
            if (dbResult.rows.length > 0 && !validatedNames.includes(dbResult.rows[0].name)) {
              archetypeFallback.push(dbResult.rows[0].name);
              break;
            }
          }
        }
      }
      console.log('Archetype fallback:', archetypeFallback);
    }
    
    const namesToFetch = potentialNames
      .filter(n => validatedNames.some(vn => vn.toLowerCase().includes(n.name.toLowerCase()) || n.name.toLowerCase().includes(vn.toLowerCase())))
      .map(n => n.name);
    
    const allNamesToFetch = [...new Set([...namesToFetch, ...archetypeFallback])];
    
    const lower = message.toLowerCase();
    const archetypePatterns = [/how does/i, /how do/i, /works with/i, /synergy/i, / deck$/i, / archetype/i, /playstyle/i, /strategy/i, /series/i, /cards in/i, /what cards/i, /what are the/i];
    const cardEffectPatterns = [/what does/i, /effect of/i, /what is/i, /what are/i, /card effect/i, /what it does/i, /how to use/i, /effect for/i, /effect in/i, /effect text/i, /card'?s effect/i, /effects of/i, /tell me the effect/i, /explain the effect/i, /effect:/i];
    
    let isAskingAboutArchetype = archetypePatterns.some(p => p.test(lower)) || (lower.includes(' about ') && cardEffectPatterns.every(p => !p.test(lower)));
    
    // Get archetype names to look up (excluding exact card names)
    const dbCardNames = new Set(validatedDbCards.map(c => c.name.toLowerCase()));
    const archetypeNamesToFetch = potentialNames
      .map(n => n.name)
      .filter(name => {
        // Skip if this name exactly matches a card in DB
        if (dbCardNames.has(name.toLowerCase())) return false;
        // Allow short names like K9, IO etc. but filter out single letters
        if (name.length < 2) return false;
        return true;
      });
    
    // Try to fetch from Yugipedia for archetype questions (on-demand)
    let yugipediaLookups = [];
    let yugipediaContext = '';
    
    if (isAskingAboutArchetype && archetypeNamesToFetch.length > 0) {
      for (const name of archetypeNamesToFetch.slice(0, 3)) {
        console.log('Fetching archetype from Yugipedia:', name);
        
        // First check KB cache
        let cached = getFromKB(name);
        if (!cached) cached = getFromKB(name.toLowerCase());
        if (!cached && name.toLowerCase().endsWith('s')) {
          cached = getFromKB(name.slice(0, -1));
        }
        
        if (cached) {
          console.log('Found in KB cache:', name);
          yugipediaLookups.push({ name, source: 'cache' });
          yugipediaContext += '\n' + formatYugipediaContext(cached);
        } else {
          // Fetch from Yugipedia API
          console.log('Fetching from Yugipedia:', name);
          let fetched = await getOrFetchFromYugipedia(name);
          if (!fetched && name.toLowerCase().endsWith('s')) {
            fetched = await getOrFetchFromYugipedia(name.slice(0, -1));
          }
          if (fetched) {
            yugipediaLookups.push({ name, source: 'yugipedia' });
            yugipediaContext += '\n' + formatYugipediaContext(fetched);
          }
        }
      }
    }

    let onDemandEffects = [];
    if (allNamesToFetch.length > 0) {
      for (const cardName of allNamesToFetch.slice(0, 8)) {
        try {
          const result = await getDb().query(
            `SELECT id, name, description, atk, def, level, attribute, type FROM cards WHERE name ILIKE $1 LIMIT 1`,
            [`%${cardName}%`]
          );
          if (result.rows.length > 0) {
            const c = result.rows[0];
            let cardInfo = `[${c.name}|${c.id}]`;
            if (c.level) cardInfo += ` LV${c.level}`;
            if (c.attribute) cardInfo += ` ${c.attribute}`;
            if (c.atk !== null) cardInfo += ` ${c.atk} ATK`;
            if (c.def !== null) cardInfo += ` / ${c.def} DEF`;
            if (c.description) {
              cardInfo += `\nEffect: ${c.description.replace(/\n/g, ' ').substring(0, 350)}`;
            }
            onDemandEffects.push(cardInfo);
          }
        } catch (e) {
          console.log('Error fetching on-demand effect for:', cardName);
        }
      }
    }

    console.log('Yugipedia context:', yugipediaContext.substring(0, 200));

    // Merge validated cards with fallback cards
    const allCards = [...validatedDbCards];
    const existingIds = new Set(allCards.map(c => c.id));
    for (const card of fallbackCards) {
      if (!existingIds.has(card.id)) {
        allCards.push(card);
      }
    }
    console.log('All cards for context:', allCards.map(c => c.name));

    let cardContext = '';
    if (allCards.length > 0) {
      cardContext = '\nCard Database:\n' + allCards.map(c => {
        let info = `[${c.name}|${c.id}]`;
        if (c.level) info += ` LV${c.level}`;
        if (c.attribute) info += ` ${c.attribute}`;
        if (c.atk !== null) info += ` ${c.atk} ATK`;
        if (c.def !== null) info += ` / ${c.def} DEF`;
        if (c.description) info += `\n${c.description.replace(/\n/g, ' ').substring(0, 250)}`;
        return info;
      }).join('\n');
    }
    
    let effectsContext = '';
    if (onDemandEffects.length > 0) {
      effectsContext = '\n══════════════════════════════════════\nCARD EFFECT TEXT (ON-DEMAND):\n══════════════════════════════════════\n' + onDemandEffects.join('\n');
    }

    let conceptEffectsContext = '';
    if (conceptEffects.length > 0) {
      conceptEffectsContext = '\n══════════════════════════════════════\nCARD EFFECTS (USE THESE):\n══════════════════════════════════════\n' + conceptEffects.join('\n');
    }

    const chatHistoryContext = formatChatHistory(chatHistory);
    
    const systemMsg = { role: "system", content: getSystemPrompt() };
    const historyMsgs = chatHistory.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content }));
    
    let userContent = '';
    if (mechanicContext) userContent += `[Game Mechanic - ${detectedMechanic.keyword.toUpperCase()}]: ${mechanicContext.text}\n`;
    if (effectQualityContext) userContent += `[Effect Quality Ranking]: S-Tier: Game-changing (negation, board breakers). A-Tier: Strong generic effects. B-Tier: Solid but conditional. C-Tier: Situational. D-Tier: Rarely impactful. QUICK EFFECTS > IGNITION EFFECTS. Battle effects are rarely competitive relevant.\n`;
    if (detectedMonsterType) userContent += `[Monster Type - ${detectedMonsterType.type.toUpperCase()}]: ${detectedMonsterType.info}\n`;
    if (detectedArchetype) userContent += `[Archetype - ${detectedArchetype.archetype}]: ${detectedArchetype.info}\nIMPORTANT: When archetype info is provided, use ONLY that - do NOT focus on individual card effects unless asked\n`;
    if (conceptContext) userContent += `[Concept Context]: ${conceptContext}\n`;
    if (conceptEffectsContext) userContent += `${conceptEffectsContext}\n`;
    if (effectsContext) userContent += `${effectsContext}\n`;
    if (yugipediaContext) userContent += `${yugipediaContext}\n`;
    if (cardContext) userContent += `${cardContext}\n`;
    if (chatHistoryContext) userContent += `${chatHistoryContext}\n`;
    userContent += `Question: ${message}`;
    
    const userMsg = { role: "user", content: userContent };
    const messages = [systemMsg, ...historyMsgs, userMsg];
    
    console.log('Sending to LLM, messages:', messages.length);

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
    console.log('LLM response:', response.substring(0, 100));

    const cardLinks = allCards.map(c => ({ name: c.name, id: c.id }));
    
    res.json({
      response,
      concept: detectedConcept,
      lookedUp: yugipediaLookups,
      cardLinks,
      sources: {
        cards: validatedDbCards.length > 0 ? 'retrieved from database' : null,
        yugipedia: yugipediaLookups.length > 0 ? 'retrieved from Yugipedia' : null
      }
    });

  } catch (err) {
    console.error("AI Chat error:", err);
    res.status(500).json({ error: "Failed to get AI response", details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

export default router;
