import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Database connection Successfull");
    } else {
      throw new Error("MongoDB URI not found");
    }
  } catch (error) {
    console.error(error);
  }
};
