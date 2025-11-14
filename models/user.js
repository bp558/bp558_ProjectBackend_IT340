const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	email: { type: String, required: true, unique: true },
	password:{ type: String, required: true },
	department: {
		type: String,
		enum: ["Development", "Marketing", "Support"],
		required: true
	}
});

module.exports = mongoose.model("User", userSchema);
