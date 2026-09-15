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
    let athleteRenderToken = 0;
    const lastAthleteStorageKey = "paceright.parent.lastAthleteId";

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

        const initialAthleteIndex = getInitialAthleteIndex();
        dropdown.value = String(initialAthleteIndex);
        showAthlete(initialAthleteIndex);

        dropdown.addEventListener("change", e => {

            showAthlete(Number(e.target.value));

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

    function readLastAthleteId() {
        try {
            return window.localStorage.getItem(lastAthleteStorageKey);
        } catch (error) {
            console.warn("Unable to read the last opened athlete", error);
            return null;
        }
    }

    function rememberAthlete(athleteId) {
        try {
            window.localStorage.setItem(lastAthleteStorageKey, String(athleteId));
        } catch (error) {
            console.warn("Unable to remember the opened athlete", error);
        }
    }

    function getInitialAthleteIndex() {
        const lastAthleteId = readLastAthleteId();
        const savedIndex = physData.findIndex(athlete =>
            String(athlete.athlete_id) === lastAthleteId
        );

        return savedIndex >= 0 ? savedIndex : 0;
    }

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

    function formatPaceForDistance(timeStr, distanceM) {

        if (!timeStr || !distanceM) return "-";

        const [m, s] = timeStr.split(":");

        const totalSec =
            parseInt(m) * 60 +
            parseFloat(s);

        const miles = Number(distanceM) / 1609.344;

        const paceSec =
            totalSec / miles;

        let paceMin = Math.floor(paceSec / 60);
        let paceRemain = Math.round(paceSec % 60);

        if (paceRemain === 60) {
            paceMin++;
            paceRemain = 0;
        }

        return `${paceMin}:${String(paceRemain).padStart(2, "0")}/mi`;
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function meetKey(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    function recurringMeetOrder(row) {
        const date = row.season_date || row.meet_pr_date;
        if (!date) return Number.MAX_SAFE_INTEGER;

        const match = String(date).match(/^(?:\d{4})-(\d{2})-(\d{2})/);
        return match ? Number(match[1]) * 100 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
    }

    function buildMeetPRHTML(rows, existingMeetRow) {
        if (!rows.length) {
            return `<div class="no-data">No 5000m meet PR data available</div>`;
        }

        const existingOrder = Object.entries(existingMeetRow || {})
            .filter(([key, value]) => key !== "athlete_id" && key !== "full_name" && value)
            .map(([key]) => meetKey(key));
        const orderIndex = new Map(existingOrder.map((key, index) => [key, index]));
        const selectedRows = existingOrder.length
            ? rows.filter(row => orderIndex.has(meetKey(row.series_name)))
            : rows;
        const orderedRows = [...selectedRows].sort((a, b) => {
            if (existingOrder.length) {
                return orderIndex.get(meetKey(a.series_name)) - orderIndex.get(meetKey(b.series_name));
            }
            return recurringMeetOrder(a) - recurringMeetOrder(b) ||
                String(a.series_name || "").localeCompare(String(b.series_name || ""));
        });

        if (!orderedRows.length) {
            return `<div class="no-data">No recurring meet PR data available</div>`;
        }

        const cards = orderedRows.map(row => `
            <div class="meet-pr-item">
                <div class="meet-pr-name">${escapeHTML(row.series_name || "Meet")}</div>
                <div class="meet-pr-result">
                    <span>${escapeHTML(row.meet_pr_raw || "—")}</span>
                    <div class="meet-pr-pace">${row.meet_pr_raw ? formatPaceForDistance(row.meet_pr_raw, row.distance_m) : ""}</div>
                </div>
                <div class="meet-pr-result">
                    <span>${escapeHTML(row.season_raw || "—")}</span>
                    <div class="meet-pr-pace">${row.season_raw ? formatPaceForDistance(row.season_raw, row.distance_m) : ""}</div>
                </div>
            </div>
        `).join("");

        return `
            <div class="meet-pr-headings">
                <span>MEET</span><span>MEET PR</span><span>THIS SEASON</span>
            </div>
            <div class="meet-pr-grid">${cards}</div>
        `;
    }

    async function loadMeetPRs(athleteId, existingMeetRow, renderToken) {
        const params = new URLSearchParams({
            select: "athlete_id,full_name,series_name,distance_m,meet_pr_seconds,meet_pr_raw,meet_pr_date,season_seconds,season_raw,season_date,seconds_from_meet_pr",
            athlete_id: `eq.${athleteId}`,
            distance_m: "eq.5000"
        });

        try {
            const response = await fetch(base + "v_athlete_meet_pr_season?" + params, { headers });
            if (!response.ok) throw new Error(`Meet PR query failed (${response.status})`);

            const rows = await response.json();
            if (renderToken !== athleteRenderToken) return;

            const target = document.getElementById("meetPRContent");
            if (target) {
                target.innerHTML = buildMeetPRHTML(
                    Array.isArray(rows) ? rows : [],
                    existingMeetRow
                );
            }
        } catch (error) {
            console.error("Unable to load meet PRs", error);
            if (renderToken !== athleteRenderToken) return;

            const target = document.getElementById("meetPRContent");
            if (target) {
                target.innerHTML = `<div class="no-data meet-pr-error">Meet PRs could not be loaded. Year-over-year data is still available.</div>`;
            }
        }
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

        if (!blocks) {

            return `
                <div class="no-data">
                    No yearly data available
                </div>
            `;
        }

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

        rememberAthlete(athlete.athlete_id);

        const meetPRs =
            getMeetPRs(athlete.athlete_id);

        const years =
            getYearRow(athlete.full_name);

        const renderToken = ++athleteRenderToken;

        document.getElementById("athleteData").innerHTML = `

            <div class="card athlete-header">

                <h2>

                    ${athlete.full_name}

                </h2>

                <div class="parent-subtitle">

                    Athlete Performance Progression

                </div>

            </div>

            <div class="card athlete-journey-card">

                <h3>

                    ATHLETE JOURNEY

                </h3>

                <h4>

                    MEET PRs

                </h4>

                <div id="meetPRContent" aria-live="polite">

                    <div class="no-data">
                        Loading meet PRs…
                    </div>

                </div>

            </div>

            <div class="card year-over-year-card">

                <h3>

                    YEAR OVER YEAR

                </h3>

                ${buildYearHTML(years)}

            </div>

        `;

        loadMeetPRs(
            athlete.athlete_id,
            meetPRs,
            renderToken
        );
    }

});
