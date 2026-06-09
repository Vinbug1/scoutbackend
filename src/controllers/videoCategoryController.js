import { videoCategoryService } from '../services/videoCategoryService.js';

// ✅ All 4 types from your schema enum
const VALID_CATEGORY_TYPES = ['SKILL', 'GENERAL', 'TACTICAL', 'PHYSICAL'];

// POST /api/videoCategory
export const create = async (req, res) => {
  try {
    const { title, categoryType } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ message: 'Title is required.' });
    }

    if (categoryType && !VALID_CATEGORY_TYPES.includes(categoryType)) {
      return res.status(400).json({
        message: `Invalid categoryType. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}.`,
      });
    }

    const category = await videoCategoryService.create(title.trim(), categoryType);
    return res.status(201).json(category);
  } catch (error) {
    console.error('[VideoCategory] create error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// GET /api/videoCategory?categoryType=SKILL
export const findAll = async (req, res) => {
  try {
    const { categoryType } = req.query;

    if (categoryType && !VALID_CATEGORY_TYPES.includes(categoryType)) {
      return res.status(400).json({
        message: `Invalid categoryType. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}.`,
      });
    }

    const categories = await videoCategoryService.findAll(categoryType);
    return res.status(200).json(categories);
  } catch (error) {
    console.error('[VideoCategory] findAll error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// GET /api/videoCategory/:id
export const findById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid category ID.' });
    }

    const category = await videoCategoryService.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    return res.status(200).json(category);
  } catch (error) {
    console.error('[VideoCategory] findById error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// PATCH /api/videoCategory/:id
export const update = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid category ID.' });
    }

    const { title, categoryType } = req.body;

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ message: 'Title must be a non-empty string.' });
    }

    if (categoryType && !VALID_CATEGORY_TYPES.includes(categoryType)) {
      return res.status(400).json({
        message: `Invalid categoryType. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}.`,
      });
    }

    if (!title && !categoryType) {
      return res.status(400).json({ message: 'Provide at least a title or categoryType to update.' });
    }

    const existing = await videoCategoryService.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const data = {};
    if (title)        data.title        = title.trim();
    if (categoryType) data.categoryType = categoryType;

    const updated = await videoCategoryService.update(id, data);
    return res.status(200).json(updated);
  } catch (error) {
    // P2025 = record not found on update
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Category not found.' });
    }
    console.error('[VideoCategory] update error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// DELETE /api/videoCategory/:id
export const remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid category ID.' });
    }

    const existing = await videoCategoryService.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    await videoCategoryService.delete(id);
    return res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
    // P2003 = category still has reels attached
    if (error.code === 'P2003') {
      return res.status(409).json({
        message: 'Cannot delete category — it still has reels attached to it.',
      });
    }
    console.error('[VideoCategory] delete error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};


















// import { videoCategoryService } from '../services/videoCategoryService.js';

// const VALID_CATEGORY_TYPES = ['SKILL', 'GENERAL'];

// // POST /api/videoCategory
// export const create = async (req, res) => {
//   try {
//     const { title, categoryType } = req.body;

//     if (!title || typeof title !== 'string' || title.trim() === '') {
//       return res.status(400).json({ message: 'Title is required.' });
//     }

//     if (categoryType && !VALID_CATEGORY_TYPES.includes(categoryType)) {
//       return res.status(400).json({
//         message: `Invalid categoryType. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}.`,
//       });
//     }

//     const category = await videoCategoryService.create(title.trim(), categoryType);
//     return res.status(201).json(category);
//   } catch (error) {
//     console.error('[VideoCategory] create error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // GET /api/videoCategory?categoryType=SKILL
// export const findAll = async (req, res) => {
//   try {
//     const { categoryType } = req.query;

//     if (categoryType && !VALID_CATEGORY_TYPES.includes(categoryType)) {
//       return res.status(400).json({
//         message: `Invalid categoryType. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}.`,
//       });
//     }

//     const categories = await videoCategoryService.findAll(categoryType);
//     return res.status(200).json(categories);
//   } catch (error) {
//     console.error('[VideoCategory] findAll error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // GET /api/videoCategory/:id
// export const findById = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);

//     if (isNaN(id)) {
//       return res.status(400).json({ message: 'Invalid category ID.' });
//     }

//     const category = await videoCategoryService.findById(id);

//     if (!category) {
//       return res.status(404).json({ message: 'Category not found.' });
//     }

//     return res.status(200).json(category);
//   } catch (error) {
//     console.error('[VideoCategory] findById error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // PATCH /api/videoCategory/:id
// export const update = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);

//     if (isNaN(id)) {
//       return res.status(400).json({ message: 'Invalid category ID.' });
//     }

//     const { title, categoryType } = req.body;

//     if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
//       return res.status(400).json({ message: 'Title must be a non-empty string.' });
//     }

//     if (categoryType && !VALID_CATEGORY_TYPES.includes(categoryType)) {
//       return res.status(400).json({
//         message: `Invalid categoryType. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}.`,
//       });
//     }

//     if (!title && !categoryType) {
//       return res.status(400).json({ message: 'Provide at least a title or categoryType to update.' });
//     }

//     const existing = await videoCategoryService.findById(id);
//     if (!existing) {
//       return res.status(404).json({ message: 'Category not found.' });
//     }

//     const data = {};
//     if (title)        data.title        = title.trim();
//     if (categoryType) data.categoryType = categoryType;

//     const updated = await videoCategoryService.update(id, data);
//     return res.status(200).json(updated);
//   } catch (error) {
//     console.error('[VideoCategory] update error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // DELETE /api/videoCategory/:id
// export const remove = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);

//     if (isNaN(id)) {
//       return res.status(400).json({ message: 'Invalid category ID.' });
//     }

//     const existing = await videoCategoryService.findById(id);
//     if (!existing) {
//       return res.status(404).json({ message: 'Category not found.' });
//     }

//     await videoCategoryService.delete(id);
//     return res.status(204).send();
//   } catch (error) {
//     console.error('[VideoCategory] delete error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };
















// import { videoCategoryService } from '../services/videoCategoryService.js';

// // POST /api/video-categories
// export const create = async (req, res) => {
//   try {
//     const { title } = req.body;

//     if (!title || typeof title !== 'string' || title.trim() === '') {
//       return res.status(400).json({ message: 'Title is required.' });
//     }

//     const category = await videoCategoryService.create(title.trim());
//     return res.status(201).json(category);
//   } catch (error) {
//     console.error('[VideoCategory] create error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // GET /api/video-categories
// export const findAll = async (req, res) => {
//   try {
//     const categories = await videoCategoryService.findAll();
//     return res.status(200).json(categories);
//   } catch (error) {
//     console.error('[VideoCategory] findAll error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // GET /api/video-categories/:id
// export const findById = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);

//     if (isNaN(id)) {
//       return res.status(400).json({ message: 'Invalid category ID.' });
//     }

//     const category = await videoCategoryService.findById(id);

//     if (!category) {
//       return res.status(404).json({ message: 'Category not found.' });
//     }

//     return res.status(200).json(category);
//   } catch (error) {
//     console.error('[VideoCategory] findById error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // PATCH /api/video-categories/:id
// export const update = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);

//     if (isNaN(id)) {
//       return res.status(400).json({ message: 'Invalid category ID.' });
//     }

//     const { title } = req.body;

//     if (!title || typeof title !== 'string' || title.trim() === '') {
//       return res.status(400).json({ message: 'Title is required.' });
//     }

//     const existing = await videoCategoryService.findById(id);
//     if (!existing) {
//       return res.status(404).json({ message: 'Category not found.' });
//     }

//     const updated = await videoCategoryService.update(id, title.trim());
//     return res.status(200).json(updated);
//   } catch (error) {
//     console.error('[VideoCategory] update error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

// // DELETE /api/video-categories/:id
// export const remove = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);

//     if (isNaN(id)) {
//       return res.status(400).json({ message: 'Invalid category ID.' });
//     }

//     const existing = await videoCategoryService.findById(id);
//     if (!existing) {
//       return res.status(404).json({ message: 'Category not found.' });
//     }

//     await videoCategoryService.delete(id);
//     return res.status(204).send();
//   } catch (error) {
//     console.error('[VideoCategory] delete error:', error);
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// };

