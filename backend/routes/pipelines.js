const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/pipelines ────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    // Get pipelines with their stages
    const [pipelines] = await pool.query(
      'SELECT * FROM pipelines WHERE is_active = TRUE ORDER BY is_default DESC, created_at ASC'
    );

    // Get stages for each pipeline in a single query
    if (pipelines.length > 0) {
      const pipelineIds = pipelines.map(p => p.id);
      const [stages] = await pool.query(
        'SELECT * FROM stages WHERE pipeline_id IN (?) ORDER BY sort_order ASC',
        [pipelineIds]
      );

      // Attach stages to pipelines
      const pipelineMap = pipelines.map(p => ({
        ...p,
        stages: stages.filter(s => s.pipeline_id === p.id),
      }));

      return res.json({ success: true, data: pipelineMap });
    }

    res.json({ success: true, data: [] });
  } catch (err) {
    console.error('Get pipelines error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/pipelines/:id ────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [pipelines] = await pool.query('SELECT * FROM pipelines WHERE id = ?', [req.params.id]);
    if (pipelines.length === 0) {
      return res.status(404).json({ success: false, message: 'Pipeline not found.' });
    }

    const [stages] = await pool.query(
      'SELECT * FROM stages WHERE pipeline_id = ? ORDER BY sort_order ASC',
      [req.params.id]
    );

    const pipeline = pipelines[0];
    pipeline.stages = stages;

    res.json({ success: true, data: pipeline });
  } catch (err) {
    console.error('Get pipeline error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/pipelines ───────────────────────────────
router.post('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, name_ar, description, description_ar, is_default } = req.body;

    const [result] = await pool.query(
      'INSERT INTO pipelines (name, name_ar, description, description_ar, is_default, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, name_ar, description, description_ar, is_default || false, req.user.id]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create pipeline error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/pipelines/:id ────────────────────────────
router.put('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, name_ar, description, description_ar, is_default } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (name_ar !== undefined) { updates.push('name_ar = ?'); values.push(name_ar); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (description_ar !== undefined) { updates.push('description_ar = ?'); values.push(description_ar); }
    if (is_default !== undefined) { updates.push('is_default = ?'); values.push(is_default); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE pipelines SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Pipeline updated.' });
  } catch (err) {
    console.error('Update pipeline error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/pipelines/:id ─────────────────────────
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE pipelines SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Pipeline deactivated.' });
  } catch (err) {
    console.error('Delete pipeline error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/pipelines/:id/stages ────────────────────
router.post('/:id/stages', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, name_ar, probability_pct, sort_order, color_hex, is_won, is_lost } = req.body;

    const [result] = await pool.query(
      `INSERT INTO stages (pipeline_id, name, name_ar, probability_pct, sort_order, color_hex, is_won, is_lost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, name, name_ar, probability_pct || 0, sort_order || 0, color_hex || '#6B7280', is_won || false, is_lost || false]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Add stage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/pipelines/:pipelineId/stages/:stageId ───
router.put('/:pipelineId/stages/:stageId', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, name_ar, probability_pct, sort_order, color_hex, is_won, is_lost } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (name_ar !== undefined) { updates.push('name_ar = ?'); values.push(name_ar); }
    if (probability_pct !== undefined) { updates.push('probability_pct = ?'); values.push(probability_pct); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
    if (color_hex !== undefined) { updates.push('color_hex = ?'); values.push(color_hex); }
    if (is_won !== undefined) { updates.push('is_won = ?'); values.push(is_won); }
    if (is_lost !== undefined) { updates.push('is_lost = ?'); values.push(is_lost); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    await pool.query(`UPDATE stages SET ${updates.join(', ')} WHERE id = ? AND pipeline_id = ?`,
      [...values, req.params.stageId, req.params.pipelineId]);

    res.json({ success: true, message: 'Stage updated.' });
  } catch (err) {
    console.error('Update stage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/pipelines/:pipelineId/stages/:stageId ─
router.delete('/:pipelineId/stages/:stageId', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    // Check if any deals are in this stage
    const [deals] = await pool.query('SELECT COUNT(*) as count FROM deals WHERE stage_id = ?', [req.params.stageId]);
    if (deals[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete stage with ${deals[0].count} active deals. Move deals first.`,
      });
    }

    await pool.query('DELETE FROM stages WHERE id = ? AND pipeline_id = ?', [req.params.stageId, req.params.pipelineId]);
    res.json({ success: true, message: 'Stage deleted.' });
  } catch (err) {
    console.error('Delete stage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
