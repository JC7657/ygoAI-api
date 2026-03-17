import 'dotenv/config';
import axios from "axios";
import { getPool } from "../db/db.js";

const pool = getPool();

async function importCards() {
  console.log("Fetching cards from YGOPRODeck...");

  const response = await axios.get(
    "https://db.ygoprodeck.com/api/v7/cardinfo.php"
  );

  const cards = response.data.data;
  console.log(`Found ${cards.length} cards. Starting import...`);

  let imported = 0;
  let skipped = 0;

  for (const card of cards) {
    try {
      await pool.query(
        `
        INSERT INTO cards 
        (id, name, type, frame_type, description, atk, def, level, race, attribute, archetype, 
         linkval, linkmarkers, scale, typeline, banlist_info, misc_info)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          frame_type = EXCLUDED.frame_type,
          description = EXCLUDED.description,
          atk = EXCLUDED.atk,
          def = EXCLUDED.def,
          level = EXCLUDED.level,
          race = EXCLUDED.race,
          attribute = EXCLUDED.attribute,
          archetype = EXCLUDED.archetype,
          linkval = EXCLUDED.linkval,
          linkmarkers = EXCLUDED.linkmarkers,
          scale = EXCLUDED.scale,
          typeline = EXCLUDED.typeline,
          banlist_info = EXCLUDED.banlist_info,
          misc_info = EXCLUDED.misc_info
        `,
        [
          card.id,
          card.name,
          card.type,
          card.frameType,
          card.desc,
          card.atk ?? null,
          card.def ?? null,
          card.level ?? null,
          card.race ?? null,
          card.attribute ?? null,
          card.archetype ?? null,
          card.linkval ?? null,
          JSON.stringify(card.linkmarkers) ?? null,
          card.scale ?? null,
          JSON.stringify(card.typeline) ?? null,
          JSON.stringify(card.banlistInfo) ?? null,
          JSON.stringify(card.miscInfo) ?? null
        ]
      );
      imported++;
    } catch (err) {
      console.error(`Error importing card ${card.name}:`, err.message);
      skipped++;
    }
  }

  console.log(`Import complete! Imported: ${imported}, Skipped: ${skipped}`);
}

importCards();
