import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';

/**
 * @desc    Create a new tracked coding problem
 * @route   POST /api/problems
 * @access  Private
 */
export const createProblem = asyncHandler(async (req, res) => {
  const { title, url, difficulty, status, category, notes, timeComplexity, spaceComplexity } = req.body;

  if (!title || !difficulty) {
    res.status(400);
    throw new Error('Please include at least the problem title and difficulty');
  }

  // Create the problem and link to the authenticated user ID (req.user._id)
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
  });

  res.status(201).json({
    success: true,
    data: problem,
  });
});

/**
 * @desc    Get all tracked problems for the authenticated user
 * @route   GET /api/problems
 * @access  Private
 */
export const getProblems = asyncHandler(async (req, res) => {
  const { difficulty, status, category, search } = req.query;

  // Build the query and ensure it strictly targets the logged-in user's data
  const query = { user: req.user._id };

  // Apply optional filters if requested
  if (difficulty) {
    query.difficulty = difficulty;
  }
  if (status) {
    query.status = status;
  }
  if (category) {
    query.category = { $regex: category, $options: 'i' }; // case-insensitive regex
  }
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }

  // Retrieve problems, sorted by most recently modified/added
  const problems = await Problem.find(query).sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: problems.length,
    data: problems,
  });
});

/**
 * @desc    Get a single tracked problem by ID (authenticated user only)
 * @route   GET /api/problems/:id
 * @access  Private
 */
export const getProblemById = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);

  if (!problem) {
    res.status(404);
    throw new Error('Problem tracker record not found');
  }

  // Security Gate: Ensure the resource belongs to the requesting user
  if (problem.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to access this tracker resource');
  }

  res.status(200).json({
    success: true,
    data: problem,
  });
});

/**
 * @desc    Update an existing tracked problem (authenticated user only)
 * @route   PUT /api/problems/:id
 * @access  Private
 */
export const updateProblem = asyncHandler(async (req, res) => {
  let problem = await Problem.findById(req.params.id);

  if (!problem) {
    res.status(404);
    throw new Error('Problem tracker record not found');
  }

  // Security Gate: Ensure the problem belongs to the requesting user
  if (problem.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to modify this tracker resource');
  }

  // Update using findByIDAndUpdate to trigger pre/post models hooks safely
  problem = await Problem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: problem,
  });
});

/**
 * @desc    Delete a tracked problem (authenticated user only)
 * @route   DELETE /api/problems/:id
 * @access  Private
 */
export const deleteProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);

  if (!problem) {
    res.status(404);
    throw new Error('Problem tracker record not found');
  }

  // Security Gate: Ensure the problem belongs to the requesting user
  if (problem.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this tracker resource');
  }

  // Trigger findOneAndDelete to activate post-delete calculations
  await Problem.findOneAndDelete({ _id: req.params.id });

  res.status(200).json({
    success: true,
    message: 'Problem tracker record deleted successfully',
  });
});
