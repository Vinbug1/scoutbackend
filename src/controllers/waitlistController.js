import waitlistService from '../services/waitlistService.js';

const getClientIp = (req) => {
  // Only trust x-forwarded-for when your proxy is configured correctly.
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'
  );
};

const waitlistController = {
  async join(req, res, next) {
    try {
      const {
        email,
        fullname,
        role,
        country,
        phone,
        consent,
        source,
        turnstileToken,
      } = req.body;

      const result = await waitlistService.join({
        email,
        fullname,
        role,
        country,
        phone,
        consent,
        source,
        turnstileToken,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return res.status(result.alreadyJoined ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20, status } = req.query;

      const result = await waitlistService.getAll({
        page,
        limit,
        status,
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await waitlistService.getById(req.params.id);

      return res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { status } = req.body;

      const result = await waitlistService.updateStatus(
        req.params.id,
        status
      );

      return res.status(200).json({
        message: 'Waitlist status updated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const result = await waitlistService.remove(req.params.id);

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};

export default waitlistController;