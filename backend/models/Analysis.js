const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
    {
        item: {
            type: String,
            required: true
        },

        category: {
            type: String,
            required: true
        },

        confidence: {
            type: Number,
            required: true
        },

        disposal: {
            type: String,
            default: ""
        },

        reuseSuggestion: {
            type: String,
            default: ""
        },

        hazardWarning: {
            type: String,
            default: ""
        },

        environmentalTip: {
            type: String,
            default: ""
        },

        ecoScore: {
            type: Number,
            default: 0
        }
    },
    {
        _id: false
    }
);


const analysisSchema = new mongoose.Schema(
    {
        inputType: {
            type: String,
            enum: ["image", "text"],
            required: true
        },

        items: {
            type: [itemSchema],
            required: true
        },

        averageConfidence: {
            type: Number,
            default: 0
        },

        totalEcoScore: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);


module.exports =
    mongoose.model(
        "Analysis",
        analysisSchema
    );