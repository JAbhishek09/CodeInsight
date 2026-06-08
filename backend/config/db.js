import mongoose from 'mongoose';

/**
 * Establishes a connection to the MongoDB database using Mongoose.
 * 
 * This function reads the MONGO_URI from environment variables. If successful,
 * it logs the host of the connected database. If it fails, it logs the error
 * details and exits the process with a failure code (1).
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`=========================================`);
    console.log(` MongoDB Connected Successfully!`);
    console.log(` Host: ${conn.connection.host}`);
    console.log(` Database: ${conn.connection.name}`);
    console.log(`=========================================`);
  }
// catch (error) {
//     console.error(`=========================================`);
//     console.error(`❌ MongoDB Connection Failed!`);
//     console.error(` Error: ${error.message}`);
//     console.error(`=========================================`);
    
//     // Exit process with failure (1) to prevent the server from running without a database
//     process.exit(1);
//   }
catch (error) {
  console.log("NAME:", error.name);
  console.log("MESSAGE:", error.message);
  console.log("CODE:", error.code);
  console.log("STACK:", error.stack);
  console.log("FULL ERROR:", error);
}
};

export default connectDB;