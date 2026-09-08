const API_URL =
    "http://localhost:5000";


const imageInput =
    document.getElementById(
        "imageInput"
    );


const imagePreview =
    document.getElementById(
        "imagePreview"
    );


const analyzeImageBtn =
    document.getElementById(
        "analyzeImageBtn"
    );


const analyzeTextBtn =
    document.getElementById(
        "analyzeTextBtn"
    );


const wasteText =
    document.getElementById(
        "wasteText"
    );


const resultSection =
    document.getElementById(
        "resultSection"
    );


const resultGrid =
    document.getElementById(
        "resultGrid"
    );


const itemsDetected =
    document.getElementById(
        "itemsDetected"
    );


/* =====================================
   IMAGE PREVIEW
===================================== */

imageInput.addEventListener(
    "change",
    () => {

        const file =
            imageInput.files[0];


        if (!file) {
            return;
        }


        const allowedTypes = [

            "image/jpeg",

            "image/png",

            "image/webp"

        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            alert(
                "Please select a JPG, PNG or WEBP image."
            );


            imageInput.value =
                "";


            return;
        }


        if (
            file.size >
            10 * 1024 * 1024
        ) {

            alert(
                "Image size must be below 10MB."
            );


            imageInput.value =
                "";


            return;
        }


        const imageURL =
            URL.createObjectURL(
                file
            );


        imagePreview.innerHTML =
            "";


        const image =
            document.createElement(
                "img"
            );


        image.src =
            imageURL;


        image.alt =
            "Selected waste image";


        imagePreview.appendChild(
            image
        );
    }
);


/* =====================================
   IMAGE ANALYSIS
===================================== */

analyzeImageBtn.addEventListener(
    "click",
    async () => {

        const file =
            imageInput.files[0];


        if (!file) {

            alert(
                "Please select an image first."
            );

            return;
        }


        analyzeImageBtn.disabled =
            true;


        analyzeImageBtn.textContent =
            "Analyzing with AI...";


        try {

            const formData =
                new FormData();


            formData.append(
                "image",
                file
            );


            const response =
                await fetch(
                    `${API_URL}/api/analyze-image`,
                    {

                        method:
                            "POST",

                        body:
                            formData

                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    "Image analysis failed."
                );
            }


            showResult(
                data,
                "image"
            );


        } catch (error) {

            console.error(
                "Image Analysis Error:",
                error
            );


            alert(
                error.message ||
                "Image analysis failed."
            );


        } finally {

            analyzeImageBtn.disabled =
                false;


            analyzeImageBtn.textContent =
                "Analyze Image";
        }
    }
);


/* =====================================
   TEXT ANALYSIS
===================================== */

analyzeTextBtn.addEventListener(
    "click",
    async () => {

        const text =
            wasteText.value.trim();


        if (!text) {

            alert(
                "Please describe the waste first."
            );

            return;
        }


        if (
            text.length >
            1000
        ) {

            alert(
                "Description must be below 1000 characters."
            );

            return;
        }


        analyzeTextBtn.disabled =
            true;


        analyzeTextBtn.textContent =
            "Analyzing...";


        try {

            const response =
                await fetch(
                    `${API_URL}/api/analyze-text`,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                text

                            })

                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    "Analysis failed."
                );
            }


            showResult(
                data,
                "text"
            );


        } catch (error) {

            console.error(
                "Text Analysis Error:",
                error
            );


            alert(
                error.message ||
                "Unable to analyze waste."
            );


        } finally {

            analyzeTextBtn.disabled =
                false;


            analyzeTextBtn.textContent =
                "Analyze Waste";
        }
    }
);


/* =====================================
   DISPLAY RESULT
===================================== */

function showResult(
    data,
    inputType
) {

    resultSection.classList.remove(
        "hidden"
    );


    resultGrid.innerHTML =
        "";


    const items =
        Array.isArray(
            data.items
        )
            ? data.items
            : [];


    if (
        items.length ===
        0
    ) {

        itemsDetected.textContent =
            "0";


        const emptyCard =
            document.createElement(
                "div"
            );


        emptyCard.className =
            "result-item full";


        const title =
            document.createElement(
                "strong"
            );


        title.textContent =
            "No waste identified";


        const message =
            document.createElement(
                "p"
            );


        message.textContent =
            "Please provide a clearer image or more detailed description.";


        emptyCard.appendChild(
            title
        );


        emptyCard.appendChild(
            message
        );


        resultGrid.appendChild(
            emptyCard
        );


        return;
    }


    itemsDetected.textContent =
        items.length;


    items.forEach(
        (
            item,
            index
        ) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "result-item";


            addText(
                card,
                "span",
                `Detected Item ${index + 1}`
            );


            addText(
                card,
                "strong",
                item.item ||
                "Unknown"
            );


            addText(
                card,
                "span",
                "Waste Category"
            );


            const category =
                addText(
                    card,
                    "strong",
                    item.category ||
                    "Unknown"
                );


            category.className =
                "category-badge";


            addText(
                card,
                "span",
                "AI Confidence"
            );


            addText(
                card,
                "strong",
                `${item.confidence || 0}%`
            );


            addText(
                card,
                "span",
                "Eco Score"
            );


            const score =
                addText(
                    card,
                    "strong",
                    `${item.ecoScore || 0}/100`
                );


            score.className =
                "eco-score";


            addText(
                card,
                "span",
                "Recommended Disposal"
            );


            addText(
                card,
                "p",
                item.disposal ||
                "No disposal information available."
            );


            addText(
                card,
                "span",
                "Reuse Suggestion"
            );


            const reuse =
                addText(
                    card,
                    "p",
                    item.reuseSuggestion ||
                    "Consider whether the item can be reused before disposal."
                );


            reuse.className =
                "reuse-text";


            addText(
                card,
                "span",
                "Safety / Hazard Warning"
            );


            const hazard =
                addText(
                    card,
                    "p",
                    item.hazardWarning ||
                    "No specific hazard identified."
                );


            hazard.className =
                "hazard-text";


            addText(
                card,
                "span",
                "Sustainability Tip"
            );


            const tip =
                addText(
                    card,
                    "p",
                    item.environmentalTip ||
                    "Dispose of the item responsibly."
                );


            tip.className =
                "tip-text";


            resultGrid.appendChild(
                card
            );
        }
    );


    saveLocalHistory(
        items,
        inputType
    );


    resultSection.scrollIntoView({
        behavior:
            "smooth",

        block:
            "start"
    });
}


/* =====================================
   SAFE TEXT ELEMENT
===================================== */

function addText(
    parent,
    tag,
    text
) {

    const element =
        document.createElement(
            tag
        );


    element.textContent =
        text;


    parent.appendChild(
        element
    );


    return element;
}


/* =====================================
   LOCAL HISTORY
===================================== */

function saveLocalHistory(
    items,
    inputType
) {

    const existing =
        JSON.parse(
            localStorage.getItem(
                "ecosortHistory"
            ) ||
            "[]"
        );


    const entry = {

        id:
            Date.now(),

        inputType,

        items,

        createdAt:
            new Date().toISOString()

    };


    existing.unshift(
        entry
    );


    const limited =
        existing.slice(
            0,
            50
        );


    localStorage.setItem(
        "ecosortHistory",
        JSON.stringify(
            limited
        )
    );
}