function showAthlete(i) {

    const a = physData[i];

    const meetPRs = getMeetPRs(a.athlete_id);

    const years = getYearRow(a.full_name);

    document.getElementById("athleteData").innerHTML = `

    <div class="card athlete-header">

        <h2>${a.full_name}</h2>

        <div class="parent-subtitle">
            Athlete Performance Progression
        </div>

    </div>

    <div class="card">

        <h3>ATHLETE JOURNEY</h3>

        <div class="course-layout">

            <div>

                <h4>COURSE BESTS</h4>

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

                                <span>${v}</span>

                            </div>
                        `)
                        .join("")}

                </div>

            </div>

            <div>

                <h4>YEAR OVER YEAR</h4>

                ${buildYearHTML(years)}

            </div>

        </div>

    </div>
    `;
}
