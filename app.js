window.addEventListener("load", function () {

    const base = CONFIG.SUPABASE_URL + "/rest/v1/";
    const apiKey = CONFIG.SUPABASE_KEY;

    const headers = {
        "apikey": apiKey,
        "Authorization": "Bearer " + apiKey
    };

    let physData = [];
    let meetData = [];
    let yearData = [];

    Promise.all([

        fetch(
            base + "v_athlete_physiology",
            { headers }
        ).then(r => r.json()),

        fetch(
            base + "v_active_athlete_prs_pivot",
            { headers }
        ).then(r => r.json()),

        fetch(
            base + "v_athlete_5k_years_wide",
            { headers }
        ).then(r => r.json())

    ])

    .then(([phys, meets, years]) => {

        physData = phys || [];
        meetData = meets || [];
        yearData = years || [];

        document.getElementById("status").innerText =
            "Loaded " + physData.length + " athletes";

        const dropdown =
            document.getElementById("athleteDropdown");

        dropdown.innerHTML = "";

        physData.sort((a, b) =>
            a.full_name.localeCompare(b.full_name)
        );

        physData.forEach((a, i) => {

            const opt =
                document.createElement("option");

            opt.value = i;

            opt.textContent = a.full_name;

            dropdown.appendChild(opt);
        });

        showAthlete(0);

        dropdown.addEventListener("change", e => {

            showAthlete(e.target.value);

        });

    })

    .catch(err => {

        console.error(err);

        document.getElementById("status").innerText =
            "Error loading athlete data";

    });

    // =========================================
    // HELPERS
    // =========================================

    function getMeetPRs(id) {

        return meetData.find(r =>
            r.athlete_id === id
        );
    }

    function getYearRow(name) {

        return yearData.find(r =>
            r.full_name === name
        );
    }

    function timeToSeconds(t) {

        if (!t) return null;

        const [m, s] = t.split(":");

        return (
            parseInt(m) * 60 +
            parseFloat(s)
        );
    }

    function getImprovement(row) {

        if (!row) return null;

        const freshman =
            timeToSeconds(row.freshman_pr);

        const latest =
            timeToSeconds(row.senior_pr) ||
            timeToSeconds(row.junior_pr) ||
            timeToSeconds(row.sophomore_pr);

        if (!freshman || !latest) return null;

        const diff = freshman - latest;

        const min =
            Math.floor(diff / 60);

        const sec =
            Math.round(diff % 60)
            .toString()
            .padStart(2, "0");

        return `${min}:${sec}`;
    }

    function formatPaceFrom5k(timeStr) {

        if (!timeStr) return "-";

        const [m, s] = timeStr.split(":");

        const totalSec =
            parseInt(m) * 60 +
            parseFloat(s);

        const paceSec =
            totalSec / 3.10686;

        const paceMin =
            Math.floor(paceSec / 60);

        const paceRemain =
            Math.round(paceSec % 60)
            .toString()
            .padStart(2, "0");

        return `${paceMin}:${paceRemain}/mi`;
    }

    function buildYearHTML(row) {

        if (!row) {

            return `
                <div class="no-data">
                    No yearly data available
                </div>
            `;
        }

        const years = [

            ["Freshman", row.freshman_pr],
            ["Sophomore", row.sophomore_pr],
            ["Junior", row.junior_pr],
            ["Senior", row.senior_pr]

        ];

        const blocks = years

            .filter(([_, value]) => value)

            .map(([label, value]) => `

                <div class="year-item">

                    <div class="year-left">

                        <label>${label}</label>

                    </div>

                    <div class="year-right">

                        <span>${value}</span>

                        <div class="year-pace">

                            ${formatPaceFrom5k(value)}

                        </div>

                    </div>

                </div>

            `)

            .join("");

        const improvement =
            getImprovement(row);

        return `

            <div class="year-grid">

                ${blocks}

            </div>

            ${improvement
                ? `
                    <div class="improvement">

                        ↓ ${improvement} improvement since freshman year

                    </div>
                  `
                : ""
            }

        `;
    }

    // =========================================
    // RENDER
    // =========================================

    function showAthlete(i) {

        const athlete = physData[i];

        if (!athlete) return;

        const meetPRs =
            getMeetPRs(athlete.athlete_id);

        const years =
            getYearRow(athlete.full_name);

        document.getElementById("athleteData").innerHTML = `

            <div class="card athlete-header">

                <h2>

                    ${athlete.full_name}

                </h2>

                <div class="parent-subtitle">

                    Athlete Performance Progression

                </div>

            </div>

            <div class="card">

                <h3>

                    ATHLETE JOURNEY

                </h3>

                <div class="course-layout">

                    <div>

                        <h4>

                            COURSE BESTS

                        </h4>

                        <div class="course-grid">

                            ${Object.entries(meetPRs || {})

                                .filter(([k, v]) =>

                                    k !== "athlete_id" &&
                                    k !== "full_name" &&
                                    v

                                )

                                .map(([k, v]) => `

                                    <div class="course-item">

                                        <label>

                                            ${k.replace(/_/g, " ")}

                                        </label>

                                        <div class="course-right">

                                            <span>

                                                ${v}

                                            </span>

                                            <div class="course-pace">

                                                ${formatPaceFrom5k(v)}

                                            </div>

                                        </div>

                                    </div>

                                `)

                                .join("")
                            }

                        </div>

                    </div>

                    <div>

                        <h4>

                            YEAR OVER YEAR

                        </h4>

                        ${buildYearHTML(years)}

                    </div>

                </div>

            </div>

        `;
    }

});
