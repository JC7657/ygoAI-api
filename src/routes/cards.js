import express from "express";
import pool from "../db/db.js";

const router = express.Router();


// GET /cards?page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const offset = (page - 1) * limit;

    const result = await pool.query(
      "SELECT * FROM cards ORDER BY id LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    res.json({
      page,
      limit,
      count: result.rows.length,
      cards: result.rows
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
    const result = await pool.query(
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
    const result = await pool.query(
      "SELECT * FROM cards WHERE name ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3",
      [`%${name}%`, limit, offset]
    );

    res.json({
      page,
      limit,
      count: result.rows.length,
      cards: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;