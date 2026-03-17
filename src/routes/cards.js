import express from "express";
import { getPool } from "../db/db.js";

const router = express.Router();

const getDb = () => getPool();

function parseFilters(query) {
  const filters = {};
  
  if (query.filters) {
    const params = new URLSearchParams(query.filters);
    
    if (params.get('type')) filters.type = params.get('type').split(',');
    if (params.get('frame_type')) filters.frame_type = params.get('frame_type').split(',');
    if (params.get('attribute')) filters.attribute = params.get('attribute').split(',');
    if (params.get('race')) filters.race = params.get('race').split(',');
    if (params.get('archetype')) filters.archetype = params.get('archetype');
    if (params.get('atk_min')) filters.atk_min = parseInt(params.get('atk_min'));
    if (params.get('atk_max')) filters.atk_max = parseInt(params.get('atk_max'));
    if (params.get('def_min')) filters.def_min = parseInt(params.get('def_min'));
    if (params.get('def_max')) filters.def_max = parseInt(params.get('def_max'));
    if (params.get('level_min')) filters.level_min = parseInt(params.get('level_min'));
    if (params.get('level_max')) filters.level_max = parseInt(params.get('level_max'));
    if (params.get('linkval_min')) filters.linkval_min = parseInt(params.get('linkval_min'));
    if (params.get('linkval_max')) filters.linkval_max = parseInt(params.get('linkval_max'));
    if (params.get('scale_min')) filters.scale_min = parseInt(params.get('scale_min'));
    if (params.get('scale_max')) filters.scale_max = parseInt(params.get('scale_max'));
    if (params.get('linkmarkers')) filters.linkmarkers = params.get('linkmarkers').split(',');
    if (params.get('linkmarkers_op')) filters.linkmarkers_op = params.get('linkmarkers_op');
    if (params.get('typeline')) filters.typeline = params.get('typeline').split(',');
    if (params.get('typeline_op')) filters.typeline_op = params.get('typeline_op');
  }
  
  return filters;
}

function buildWhereClause(filters, searchType = 'name') {
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (filters.name) {
    if (searchType === 'name') {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    } else if (searchType === 'description') {
      conditions.push(`description ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    } else {
      conditions.push(`(name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`);
      params.push(`%${filters.name}%`, `%${filters.name}%`);
    }
  }
  
  if (filters.type?.length) {
    const typeConditions = filters.type.map(() => `type = $${paramIndex++}`);
    conditions.push(`(${typeConditions.join(' OR ')})`);
    params.push(...filters.type);
  }
  
  if (filters.frame_type?.length) {
    const frameConditions = filters.frame_type.map(() => `frame_type = $${paramIndex++}`);
    conditions.push(`(${frameConditions.join(' OR ')})`);
    params.push(...filters.frame_type);
  }
  
  if (filters.attribute?.length) {
    const attrConditions = filters.attribute.map(() => `attribute = $${paramIndex++}`);
    conditions.push(`(${attrConditions.join(' OR ')})`);
    params.push(...filters.attribute);
  }
  
  if (filters.race?.length) {
    const raceConditions = filters.race.map(() => `race = $${paramIndex++}`);
    conditions.push(`(${raceConditions.join(' OR ')})`);
    params.push(...filters.race);
  }
  
  if (filters.archetype) {
    conditions.push(`archetype ILIKE $${paramIndex++}`);
    params.push(`%${filters.archetype}%`);
  }
  
  if (filters.atk_min != null) {
    conditions.push(`atk >= $${paramIndex++}`);
    params.push(filters.atk_min);
  }
  
  if (filters.atk_max != null) {
    conditions.push(`atk <= $${paramIndex++}`);
    params.push(filters.atk_max);
  }
  
  if (filters.def_min != null) {
    conditions.push(`def >= $${paramIndex++}`);
    params.push(filters.def_min);
  }
  
  if (filters.def_max != null) {
    conditions.push(`def <= $${paramIndex++}`);
    params.push(filters.def_max);
  }
  
  if (filters.level_min != null) {
    conditions.push(`level >= $${paramIndex++}`);
    params.push(filters.level_min);
  }
  
  if (filters.level_max != null) {
    conditions.push(`level <= $${paramIndex++}`);
    params.push(filters.level_max);
  }
  
  if (filters.linkval_min != null) {
    conditions.push(`linkval >= $${paramIndex++}`);
    params.push(filters.linkval_min);
  }
  
  if (filters.linkval_max != null) {
    conditions.push(`linkval <= $${paramIndex++}`);
    params.push(filters.linkval_max);
  }
  
  if (filters.scale_min != null) {
    conditions.push(`scale >= $${paramIndex++}`);
    params.push(filters.scale_min);
  }
  
  if (filters.scale_max != null) {
    conditions.push(`scale <= $${paramIndex++}`);
    params.push(filters.scale_max);
  }
  
  if (filters.linkmarkers?.length) {
    const operator = filters.linkmarkers_op === 'and' ? ' AND ' : ' OR ';
    const markerConditions = filters.linkmarkers.map(() => {
      return `linkmarkers @> $${paramIndex++}::jsonb`;
    });
    conditions.push(`(${markerConditions.join(operator)})`);
    filters.linkmarkers.forEach(marker => {
      params.push(JSON.stringify([marker]));
    });
  }
  
  if (filters.typeline?.length) {
    const operator = filters.typeline_op === 'and' ? ' AND ' : ' OR ';
    const typeConditions = filters.typeline.map(() => {
      return `typeline @> $${paramIndex++}::jsonb`;
    });
    conditions.push(`(${typeConditions.join(operator)})`);
    filters.typeline.forEach(type => {
      params.push(JSON.stringify([type]));
    });
  }
  
  return { conditions, params };
}

// GET /cards?page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const name = req.query.name || null;
    const searchType = req.query.searchType || 'name';
    const filters = parseFilters(req.query);
    
    if (name) {
      filters.name = name;
    }

    const offset = (page - 1) * limit;

    const { conditions, params } = buildWhereClause(filters, searchType);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countQuery = `SELECT COUNT(*) FROM cards ${whereClause}`;
    const dataQuery = `SELECT * FROM cards ${whereClause} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const queryParams = [...params, limit, offset];
    
    const [countResult, cardsResult] = await Promise.all([
      getDb().query(countQuery, params),
      getDb().query(dataQuery, queryParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      page,
      limit,
      count: totalCount,
      cards: cardsResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// GET /cards/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await getDb().query(
      "SELECT * FROM cards WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Card not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// GET /cards/search?name=dragon&page=1&limit=20
router.get("/search/name", async (req, res) => {
  const { name } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const offset = (page - 1) * limit;

  if (!name) {
    return res.status(400).json({ error: "Name query is required" });
  }

  try {
    const searchPattern = `%${name}%`;
    
    const [countResult, cardsResult] = await Promise.all([
      getDb().query("SELECT COUNT(*) FROM cards WHERE name ILIKE $1", [searchPattern]),
      getDb().query(
        "SELECT * FROM cards WHERE name ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3",
        [searchPattern, limit, offset]
      )
    ]);

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      page,
      limit,
      count: totalCount,
      cards: cardsResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
