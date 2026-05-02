import VideoViewService from './videoViewService.js';

const VideoViewController = {
  async createView(req, res) {
    try {
      const newView = await VideoViewService.createView(req.body);
      return res.status(201).json(newView);
    } catch (err) {
      console.error(err);
      if (err.code === 'P2002') {
        return res.status(400).json({
          message: 'User has already viewed this video (unique constraint)',
        });
      }
      return res.status(500).json({ error: 'Failed to create video view' });
    }
  },

  async getAllViews(req, res) {
    try {
      const views = await VideoViewService.getAllViews();
      return res.status(200).json(views);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch views' });
    }
  },

  async getViewById(req, res) {
    try {
      const id = Number(req.params.id);
      const view = await VideoViewService.getViewById(id);
      if (!view) {
        return res.status(404).json({ message: 'Video view not found' });
      }
      return res.status(200).json(view);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch video view' });
    }
  },

  async updateView(req, res) {
    try {
      const id = Number(req.params.id);
      const updatedView = await VideoViewService.updateView(id, req.body);
      return res.status(200).json(updatedView);
    } catch (err) {
      console.error(err);
      if (err.code === 'P2002') {
        return res.status(400).json({
          message: 'Duplicate view — this user already viewed this video',
        });
      }
      return res.status(500).json({ error: 'Failed to update video view' });
    }
  },

  async deleteView(req, res) {
    try {
      const id = Number(req.params.id);
      await VideoViewService.deleteView(id);
      return res.status(200).json({ message: 'Video view deleted' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to delete video view' });
    }
  },
};

export default VideoViewController;