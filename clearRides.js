const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || "mongodb+srv://shivamgem222_db_user:ZYYJgSCbwfNNBAar@cluster0.3hxan6v.mongodb.net/?appName=Cluster0";

async function clearRides() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    
    // Mongoose maps the 'Ride' model to the 'rides' collection by default
    const result = await db.collection('rides').deleteMany({});
    console.log("Deleted rides count:", result.deletedCount);
    
    process.exit(0);
  } catch (err) {
    console.error("Error clearing rides:", err);
    process.exit(1);
  }
}

clearRides();
