import mongoose from 'mongoose';

const ProblemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Problem must be associated with a user profile'],
    },
    title: {
      type: String,
      required: [true, 'Please provide the coding problem title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    url: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        'Please provide a valid problem URL',
      ],
    },
    difficulty: {
      type: String,
      required: [true, 'Please specify the problem difficulty'],
      enum: {
        values: ['Easy', 'Medium', 'Hard'],
        message: 'Difficulty must be either Easy, Medium, or Hard',
      },
    },
    status: {
      type: String,
      required: [true, 'Please specify problem solving status'],
      enum: {
        values: ['Solved', 'Attempted', 'To Do'],
        message: 'Status must be either Solved, Attempted, or To Do',
      },
      default: 'Solved',
    },
    category: {
      type: String,
      required: [true, 'Please specify a category or data structure'],
      trim: true,
      default: 'General',
    },
    notes: {
      type: String,
      trim: true,
    },
    timeComplexity: {
      type: String,
      trim: true,
      default: 'O(N)',
    },
    spaceComplexity: {
      type: String,
      trim: true,
      default: 'O(N)',
    },
  },
  {
    timestamps: true,
  }
);

// After saving or deleting a solved problem, update the user's total solvedProblemsCount
// Post-save middleware
ProblemSchema.post('save', async function (doc, next) {
  try {
    const ProblemModel = doc.constructor;
    const solvedCount = await ProblemModel.countDocuments({
      user: doc.user,
      status: 'Solved',
    });
    
    await mongoose.model('User').findByIdAndUpdate(doc.user, {
      solvedProblemsCount: solvedCount,
    });
  } catch (error) {
    console.error(`Error updating User solved count on save: ${error.message}`);
  }
  next();
});

// Post-delete/remove middleware (supports both pre/post or hook triggers)
ProblemSchema.post('findOneAndDelete', async function (doc, next) {
  if (doc) {
    try {
      const solvedCount = await mongoose.model('Problem').countDocuments({
        user: doc.user,
        status: 'Solved',
      });
      
      await mongoose.model('User').findByIdAndUpdate(doc.user, {
        solvedProblemsCount: solvedCount,
      });
    } catch (error) {
      console.error(`Error updating User solved count on delete: ${error.message}`);
    }
  }
  next();
});

// Also trigger update if status was modified (on update)
ProblemSchema.post('findOneAndUpdate', async function (doc, next) {
  if (doc) {
    try {
      const solvedCount = await mongoose.model('Problem').countDocuments({
        user: doc.user,
        status: 'Solved',
      });
      
      await mongoose.model('User').findByIdAndUpdate(doc.user, {
        solvedProblemsCount: solvedCount,
      });
    } catch (error) {
      console.error(`Error updating User solved count on update: ${error.message}`);
    }
  }
  next();
});

const Problem = mongoose.model('Problem', ProblemSchema);

export default Problem;
