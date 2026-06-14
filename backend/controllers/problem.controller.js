import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';

/**
 * @desc    Create a manual problem entry
 * @route   POST /api/problems
 * @access  Private
 */
export const createProblem = asyncHandler(async (req, res) => {
  const { title, url, difficulty, status, category, notes, timeComplexity, spaceComplexity } = req.body;

  if (!title || !difficulty) {
    res.status(400);
    throw new Error('Please include at least a title and difficulty');
  }

  const problem = await Problem.create({
    user: req.user._id,
    title,
    url,
    difficulty,
    status: status || 'Solved',
    category: category || 'General',
    notes,
    timeComplexity,
    spaceComplexity,
    platform: 'manual',
  });

  res.status(201).json({ success: true, data: problem });
});

/**
 * @desc    Get all problems for the logged-in user
 * @route   GET /api/problems
 * @access  Private
 */
export const getProblems = asyncHandler(async (req, res) => {
  const { difficulty, status, category, search, platform } = req.query;
  const query = { user: req.user._id };

  if (difficulty) query.difficulty = difficulty;
  if (status) query.status = status;
  if (platform) query.platform = platform;
  if (category) query.category = { $regex: category, $options: 'i' };
  if (search) query.title = { $regex: search, $options: 'i' };

  const problems = await Problem.find(query).sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: problems.length,
    data: problems,
  });
});

/**
 * @desc    Get a single problem by ID
 * @route   GET /api/problems/:id
 * @access  Private
 */
export const getProblemById = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);

  if (!problem) {
    res.status(404);
    throw new Error('Problem not found');
  }

  if (problem.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to access this problem');
  }

  res.status(200).json({ success: true, data: problem });
});

/**
 * @desc    Update a problem
 * @route   PUT /api/problems/:id
 * @access  Private
 */
export const updateProblem = asyncHandler(async (req, res) => {
  let problem = await Problem.findById(req.params.id);

  if (!problem) {
    res.status(404);
    throw new Error('Problem not found');
  }

  if (problem.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to modify this problem');
  }

  problem = await Problem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: problem });
});

/**
 * @desc    Delete a problem
 * @route   DELETE /api/problems/:id
 * @access  Private
 */
export const deleteProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);

  if (!problem) {
    res.status(404);
    throw new Error('Problem not found');
  }

  if (problem.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this problem');
  }

  await Problem.findOneAndDelete({ _id: req.params.id });

  res.status(200).json({ success: true, message: 'Problem deleted' });
});
