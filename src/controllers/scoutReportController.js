import scoutReportService from '../services/scoutReportService.js';

const scoutReportController = {

  async create(req, res) {
    try {
      const { scoutId, playerId } = req.body;
      if (!scoutId || !playerId) {
        return res.status(400).json({ error: 'scoutId and playerId are required' });
      }

      const report = await scoutReportService.create(req.body);
      res.status(201).json({ message: 'Report created successfully', data: report });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to create report' });
    }
  },

  async getAll(req, res) {
    try {
      const result = await scoutReportService.getAll(req.query);
      res.status(200).json(result);
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch reports' });
    }
  },

  async getById(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });

      const report = await scoutReportService.getById(id);
      res.status(200).json({ data: report });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch report' });
    }
  },

  async update(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });

      const { scoutId, ...updateData } = req.body;
      const report = await scoutReportService.update(id, scoutId, updateData);
      res.status(200).json({ message: 'Report updated successfully', data: report });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to update report' });
    }
  },

  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });

      await scoutReportService.delete(id);
      res.status(200).json({ message: 'Report deleted successfully' });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to delete report' });
    }
  },
};

export default scoutReportController;


