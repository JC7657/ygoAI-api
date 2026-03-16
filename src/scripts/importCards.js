const axios = require("axios");
const pool = require("../db/db");

async function importCards() {

  const response = await axios.get(
    "https://db.ygoprodeck.com/api/v7/cardinfo.php"
  );

  const cards = response.data.data;

  for (const card of cards) {

    await pool.query(
      `
      INSERT INTO cards
      (id,name,type,frame_type,description,atk,def,level,race,attribute,archetype)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        card.id,
        card.name,
        card.type,
        card.frameType,
        card.desc,
        card.atk || null,
        card.def || null,
        card.level || null,
        card.race || null,
        card.attribute || null,
        card.archetype || null
      ]
    );

  }

  console.log("Cards imported");
}

importCards();