const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { GoogleGenAI } = require("@google/genai");

const Analysis =
    require("./models/Analysis");


dotenv.config();


const app =
    express();


/* =====================================
   SECURITY
===================================== */

app.use(
    helmet({
        crossOriginResourcePolicy: false
    })
);


app.use(
    cors({
        origin: true
    })
);


app.use(
    express.json({
        limit: "1mb"
    })
);


/* =====================================
   RATE LIMIT
===================================== */

const aiLimiter =
    rateLimit({

        windowMs:
            60 * 1000,

        max:
            20,

        message: {
            message:
                "Too many AI requests. Please try again later."
        }
    });


/* =====================================
   GEMINI
===================================== */

if (!process.env.GEMINI_API_KEY) {

    console.error(
        "GEMINI_API_KEY is missing from .env"
    );
}


const ai =
    new GoogleGenAI({
        apiKey:
            process.env.GEMINI_API_KEY
    });


/* =====================================
   MONGODB
===================================== */

let databaseConnected =
    false;


async function connectDatabase() {

    if (
        !process.env.MONGODB_URI
    ) {

        console.log(
            "MongoDB URI not provided."
        );

        console.log(
            "Running without database."
        );

        return;
    }


    try {

        await mongoose.connect(
            process.env.MONGODB_URI
        );


        databaseConnected =
            true;


        console.log(
            "MongoDB connected successfully."
        );

    } catch (error) {

        console.error(
            "MongoDB connection failed:"
        );

        console.error(
            error.message
        );

        console.log(
            "Continuing without MongoDB."
        );
    }
}


/* =====================================
   IMAGE UPLOAD
===================================== */

const upload =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {
            fileSize:
                10 * 1024 * 1024
        },

        fileFilter:
            (req, file, cb) => {

                const allowedTypes = [

                    "image/jpeg",

                    "image/png",

                    "image/webp"

                ];


                if (
                    allowedTypes.includes(
                        file.mimetype
                    )
                ) {

                    cb(
                        null,
                        true
                    );

                } else {

                    cb(
                        new Error(
                            "Only JPG, PNG and WEBP images are allowed."
                        )
                    );
                }
            }
    });


/* =====================================
   ALLOWED CATEGORIES
===================================== */

const allowedCategories = [

    "Organic",

    "Recyclable",

    "E-Waste",

    "Hazardous",

    "Glass",

    "General Waste",

    "Unknown"

];


/* =====================================
   NORMALIZE AI ITEM
===================================== */

function normalizeItem(
    item
) {

    const confidence =
        Number(
            item.confidence
        ) || 0;


    let category =
        item.category ||
        "Unknown";


    if (
        !allowedCategories.includes(
            category
        )
    ) {

        category =
            "Unknown";
    }


    if (
        confidence < 60
    ) {

        category =
            "Unknown";
    }


    return {

        item:
            item.item ||
            "Unknown",

        category,

        confidence:
            Math.max(
                0,
                Math.min(
                    100,
                    confidence
                )
            ),

        disposal:
            item.disposal ||
            "Follow local waste-management guidelines.",

        reuseSuggestion:
            item.reuseSuggestion ||
            "Consider whether the item can be reused before disposal.",

        hazardWarning:
            item.hazardWarning ||
            "No specific hazard identified.",

        environmentalTip:
            item.environmentalTip ||
            "Dispose of the item responsibly."
    };
}


/* =====================================
   ECO SCORE
===================================== */

function calculateEcoScore(
    item
) {

    let score =
        50;


    switch (
        item.category
    ) {

        case "Recyclable":

            score += 25;

            break;


        case "Organic":

            score += 25;

            break;


        case "Glass":

            score += 20;

            break;


        case "E-Waste":

            score += 10;

            break;


        case "Hazardous":

            score -= 10;

            break;


        case "General Waste":

            score -= 15;

            break;


        case "Unknown":

            score =
                30;

            break;
    }


    score +=
        Math.round(
            item.confidence /
            10
        );


    return Math.max(
        0,
        Math.min(
            100,
            score
        )
    );
}


/* =====================================
   SAVE ANALYSIS
===================================== */

async function saveAnalysis(
    inputType,
    items
) {

    if (
        !databaseConnected
    ) {

        return null;
    }


    try {

        const averageConfidence =
            Math.round(

                items.reduce(
                    (
                        total,
                        item
                    ) => {

                        return (
                            total +
                            item.confidence
                        );

                    },
                    0
                ) /
                items.length
            );


        const totalEcoScore =
            Math.round(

                items.reduce(
                    (
                        total,
                        item
                    ) => {

                        return (
                            total +
                            item.ecoScore
                        );

                    },
                    0
                ) /
                items.length
            );


        const analysis =
            await Analysis.create({

                inputType,

                items,

                averageConfidence,

                totalEcoScore

            });


        return analysis;

    } catch (error) {

        console.error(
            "Failed to save analysis:"
        );

        console.error(
            error.message
        );

        return null;
    }
}


/* =====================================
   HOME
===================================== */

app.get(
    "/",
    (req, res) => {

        res.json({

            message:
                "EcoSort AI Backend is running!",

            ai:
                "Gemini connected",

            database:
                databaseConnected
                    ? "Connected"
                    : "Not connected",

            version:
                "2.0.0"

        });
    }
);


/* =====================================
   TEXT ANALYSIS
===================================== */

app.post(
    "/api/analyze-text",
    aiLimiter,
    async (
        req,
        res
    ) => {

        try {

            const text =
                typeof req.body.text ===
                "string"

                    ? req.body.text.trim()

                    : "";


            if (!text) {

                return res.status(
                    400
                ).json({

                    message:
                        "Waste description is required."

                });
            }


            if (
                text.length >
                1000
            ) {

                return res.status(
                    400
                ).json({

                    message:
                        "Waste description is too long."

                });
            }


            const prompt = `

You are EcoSort AI.

You are an AI-powered waste
classification and sustainability assistant.

Analyze the user's waste description.

Classify the waste into exactly ONE
of these categories:

Organic
Recyclable
E-Waste
Hazardous
Glass
General Waste
Unknown

Return ONLY valid JSON.

Required format:

{
    "items": [
        {
            "item": "detected waste item",
            "category": "waste category",
            "confidence": 0,
            "disposal": "recommended disposal method",
            "reuseSuggestion": "practical reuse possibility",
            "hazardWarning": "safety warning or no specific hazard identified",
            "environmentalTip": "short sustainability tip"
        }
    ]
}

Rules:

1. Confidence must be between 0 and 100.

2. If confidence is below 60,
   category must be Unknown.

3. Mobile phones, laptops, chargers,
   computers and electronic devices
   are E-Waste.

4. Batteries, chemicals, medical waste
   and dangerous materials are Hazardous.

5. Food scraps, fruit peels and
   vegetable waste are Organic.

6. Paper, cardboard and clean recyclable
   plastic are Recyclable.

7. Glass containers are Glass.

8. Give practical disposal advice.

9. Do not invent specific recycling
   centers or collection facilities.

10. Give realistic reuse suggestions.

11. Mention important safety concerns
    for hazardous items.

12. Do not include markdown.

13. Return JSON only.

User description:

${text}

`;


            const interaction =
                await ai.interactions.create({

                    model:
                        "gemini-3.8-flash",

                    input:
                        prompt

                });


            const aiText =
                interaction.output_text;


            const cleanedText =
                aiText
                    .replace(
                        /```json/g,
                        ""
                    )
                    .replace(
                        /```/g,
                        ""
                    )
                    .trim();


            const result =
                JSON.parse(
                    cleanedText
                );


            let items =
                Array.isArray(
                    result.items
                )
                    ? result.items
                    : [];


            items =
                items.map(
                    normalizeItem
                );


            items =
                items.map(
                    item => {

                        return {

                            ...item,

                            ecoScore:
                                calculateEcoScore(
                                    item
                                )

                        };
                    }
                );


            if (
                items.length ===
                0
            ) {

                items = [

                    normalizeItem({

                        item:
                            "Unknown",

                        category:
                            "Unknown",

                        confidence:
                            0,

                        disposal:
                            "Unable to determine disposal method.",

                        reuseSuggestion:
                            "Please provide a clearer description.",

                        hazardWarning:
                            "Unable to determine potential hazards.",

                        environmentalTip:
                            "Please provide more information."

                    })

                ];


                items[0].ecoScore =
                    calculateEcoScore(
                        items[0]
                    );
            }


            await saveAnalysis(
                "text",
                items
            );


            res.json({
                items
            });


        } catch (error) {

            console.error(
                "TEXT ANALYSIS ERROR:"
            );

            console.error(
                error
            );


            res.status(
                500
            ).json({

                message:
                    "AI analysis failed.",

                error:
                    error.message

            });
        }
    }
);


/* =====================================
   IMAGE ANALYSIS
===================================== */

app.post(
    "/api/analyze-image",
    aiLimiter,
    upload.single("image"),
    async (
        req,
        res
    ) => {

        try {

            if (
                !req.file
            ) {

                return res.status(
                    400
                ).json({

                    message:
                        "Please upload an image."

                });
            }


            const imageBase64 =
                req.file.buffer.toString(
                    "base64"
                );


            const prompt = `

You are EcoSort AI.

You are an AI-powered waste
classification and sustainability assistant.

Analyze the uploaded image.

Identify ALL clearly visible waste items.

Each item must be returned separately.

Categories:

Organic
Recyclable
E-Waste
Hazardous
Glass
General Waste
Unknown

Return ONLY valid JSON.

Required format:

{
    "items": [
        {
            "item": "detected waste item",
            "category": "waste category",
            "confidence": 0,
            "disposal": "recommended disposal method",
            "reuseSuggestion": "practical reuse possibility",
            "hazardWarning": "safety warning or no specific hazard identified",
            "environmentalTip": "short sustainability tip"
        }
    ]
}

Rules:

1. Identify all clearly visible waste items.

2. Do not identify normal background objects
   unless they are clearly waste.

3. Do not duplicate the same waste item.

4. Confidence must be between 0 and 100.

5. If confidence is below 60,
   category must be Unknown.

6. Mobile phones, laptops, chargers
   and computers are E-Waste.

7. Batteries, chemicals and medical
   waste are Hazardous.

8. Food scraps, fruit peels and
   vegetable waste are Organic.

9. Paper, cardboard and suitable
   recyclable plastic are Recyclable.

10. Glass containers are Glass.

11. Provide practical disposal advice.

12. Do not invent specific recycling
    centers.

13. Give realistic reuse suggestions.

14. Clearly mention hazards when
    appropriate.

15. Do not include markdown.

16. Return JSON only.

17. If no waste can be identified,
    return one Unknown item.

`;


            const interaction =
                await ai.interactions.create({

                    model:
                        "gemini-3.8-flash",

                    input: [

                        {

                            type:
                                "text",

                            text:
                                prompt

                        },

                        {

                            type:
                                "image",

                            data:
                                imageBase64,

                            mime_type:
                                req.file.mimetype

                        }

                    ]

                });


            const aiText =
                interaction.output_text;


            console.log(
                "Gemini Image Response:"
            );

            console.log(
                aiText
            );


            const cleanedText =
                aiText
                    .replace(
                        /```json/g,
                        ""
                    )
                    .replace(
                        /```/g,
                        ""
                    )
                    .trim();


            const result =
                JSON.parse(
                    cleanedText
                );


            let items =
                Array.isArray(
                    result.items
                )
                    ? result.items
                    : [];


            items =
                items.map(
                    normalizeItem
                );


            items =
                items.map(
                    item => {

                        return {

                            ...item,

                            ecoScore:
                                calculateEcoScore(
                                    item
                                )

                        };
                    }
                );


            if (
                items.length ===
                0
            ) {

                items = [

                    normalizeItem({

                        item:
                            "Unknown",

                        category:
                            "Unknown",

                        confidence:
                            0,

                        disposal:
                            "Unable to determine disposal method.",

                        reuseSuggestion:
                            "Please upload a clearer image.",

                        hazardWarning:
                            "Unable to determine potential hazards.",

                        environmentalTip:
                            "Try uploading a clearer image."

                    })

                ];


                items[0].ecoScore =
                    calculateEcoScore(
                        items[0]
                    );
            }


            await saveAnalysis(
                "image",
                items
            );


            res.json({
                items
            });


        } catch (error) {

            console.error(
                "IMAGE ANALYSIS ERROR:"
            );

            console.error(
                error
            );


            res.status(
                500
            ).json({

                message:
                    "Image analysis failed.",

                error:
                    error.message

            });
        }
    }
);


/* =====================================
   HISTORY
===================================== */

app.get(
    "/api/history",
    async (
        req,
        res
    ) => {

        try {

            if (
                !databaseConnected
            ) {

                return res.json({
                    items: []
                });
            }


            const history =
                await Analysis
                    .find()
                    .sort({
                        createdAt:
                            -1
                    })
                    .limit(50);


            res.json({
                items:
                    history
            });


        } catch (error) {

            console.error(
                "HISTORY ERROR:",
                error.message
            );


            res.status(
                500
            ).json({

                message:
                    "Unable to load history."

            });
        }
    }
);


/* =====================================
   STATISTICS
===================================== */

app.get(
    "/api/statistics",
    async (
        req,
        res
    ) => {

        try {

            if (
                !databaseConnected
            ) {

                return res.json({

                    totalAnalyses:
                        0,

                    totalItems:
                        0,

                    averageConfidence:
                        0,

                    averageEcoScore:
                        0,

                    categories: {}

                });
            }


            const analyses =
                await Analysis.find();


            let totalItems =
                0;


            let confidenceTotal =
                0;


            let scoreTotal =
                0;


            const categories =
                {};


            analyses.forEach(
                analysis => {

                    analysis.items.forEach(
                        item => {

                            totalItems++;


                            confidenceTotal +=
                                item.confidence;


                            scoreTotal +=
                                item.ecoScore;


                            categories[
                                item.category
                            ] =
                                (
                                    categories[
                                        item.category
                                    ] ||
                                    0
                                ) + 1;

                        }
                    );
                }
            );


            res.json({

                totalAnalyses:
                    analyses.length,

                totalItems,

                averageConfidence:
                    totalItems
                        ? Math.round(
                            confidenceTotal /
                            totalItems
                        )
                        : 0,

                averageEcoScore:
                    totalItems
                        ? Math.round(
                            scoreTotal /
                            totalItems
                        )
                        : 0,

                categories

            });


        } catch (error) {

            console.error(
                "STATISTICS ERROR:",
                error.message
            );


            res.status(
                500
            ).json({

                message:
                    "Unable to load statistics."

            });
        }
    }
);


/* =====================================
   ERROR HANDLER
===================================== */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            error.message
        );


        if (
            error instanceof
            multer.MulterError
        ) {

            return res.status(
                400
            ).json({

                message:
                    "Image upload error."

            });
        }


        res.status(
            500
        ).json({

            message:
                error.message ||
                "Internal server error."

        });
    }
);


/* =====================================
   START SERVER
===================================== */

const PORT =
    process.env.PORT ||
    5000;


connectDatabase()
    .finally(
        () => {

            app.listen(
                PORT,
                () => {

                    console.log(
                        `EcoSort AI server running on http://localhost:${PORT}`
                    );

                }
            );
        }
    );