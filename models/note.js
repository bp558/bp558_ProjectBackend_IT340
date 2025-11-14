const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
	title: String,
	content: String,
	department: {
		type: String,
		enum: ["Development", "Marketing", "Support"],
		required: true
	},

	attachments: [
	{
		fileName: String,
		url: String,
		fileType: String,
	}
	],
	createdAt: {
		type: Date,
		default: Date.now
	}
});

module.exports = mongoose.model("Note", noteSchema);
