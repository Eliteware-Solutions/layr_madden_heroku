const express = require('express');
const admin = require('firebase-admin');

const app = express();

// TODO: Uncomment out line 13
// Refer to Picture Example Folder for help for below instructions. (hit the gear for settings, click projecgt settings, then click service accounts)
// In your firebase project settings it will give you an option to "create service account".
// This generates a service account json file. Download it, and put the file in this project.
// Enter the path to your service account json file below where it says "REPLACE_WITH_SERVICE_ACCOUNT"
// If you need more help with this step go here: https://firebase.google.com/docs/admin/setup

const serviceAccount = require("./layr-stage-firebase-adminsdk.json");

// TODO: Uncomment out line 17-21
// Enter your database url from firebase where it says <DATABASE_NAME> below.
// Refer to picture for reference. It's the 2nd property.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://layr-madden.firebaseio.com/"
});

app.set('port', (process.env.PORT || 3001));

app.get('*', (req, res) => {
    res.send('Madden Companion Exporter');
});

// res.write(JSON.stringify(JSON.parse(body)));
// res.end();

app.post('/:groupuniqueid/:platform/:leagueId/leagueteams', (req, res) => {
    const db = admin.database();
    const ref = db.ref();
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const { leagueTeamInfoList: teams } = JSON.parse(body);
        const {params: { groupuniqueid, leagueId }} = req;
        teams.forEach(team => {
            const teamRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/leagueTeams/${team.teamId}`);
            teamRef.update(team);
        });
        res.sendStatus(200);
    });
});

app.post('/:groupuniqueid/:platform/:leagueId/standings', (req, res) => {
    const db = admin.database();
    const ref = db.ref();
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const { teamStandingInfoList: teams } = JSON.parse(body);
        const {params: { groupuniqueid, leagueId }} = req;

        teams.forEach(team => {
            const standingRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/standings/${team.calendarYear}/${team.teamId}`);
            const teamRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/teams/${team.teamId}`);
            standingRef.update(team);
            teamRef.set(team);
        });
        res.sendStatus(200);
    });
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

app.post('/:groupuniqueid/:platform/:leagueId/week/:weekType/:weekNumber/:dataType', (req, res) => {
        const db = admin.database();
        const ref = db.ref();
        const {params: { groupuniqueid, leagueId, weekType, weekNumber, dataType },} = req;
        const basePath = `exportData/${groupuniqueid}/${leagueId}/`;
        // "defense", "kicking", "passing", "punting", "receiving", "rushing"
        const statsPath = `${basePath}stats`;
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            let weekTypeName = "";
            let weekTypeNumber = 0;
            if (weekType.toLowerCase() == "pre" && weekNumber < 18) {
                weekTypeName = "pre";
                weekTypeNumber = `preweek${weekNumber}`;
            } else if(weekType.toLowerCase() == "reg" && weekNumber < 18)  {
                weekTypeName = "reg";
                weekTypeNumber = `week${weekNumber}`;
            } else if (weekNumber > 17) {
                weekTypeName = "post";
                if (weekNumber == 18) {
                    weekTypeNumber = "wildcard";
                } else if (weekNumber == 19) {
                    weekTypeNumber = "divisional";
                } else if (weekNumber == 20) {
                    weekTypeNumber = "conference";
                } else {
                    weekTypeNumber = "superbowl";
                }
            }
            /*const { curWeekIdx } = weekTypeNumber;
            const curWeekIdxRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/currentWeekIndex`);
            curWeekIdxRef.update(curWeekIdx);*/
            switch (dataType) {
                case 'schedules': {
                    const { gameScheduleInfoList: schedules } = JSON.parse(body);
                    schedules.forEach(schedule => {
                        const scheduleRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${schedule.scheduleId}`);
                        scheduleRef.set(schedule);
                    });
                    /*const weekRef = ref.child(`${basePath}schedules/${weekType}/${weekNumber}`);
                    const { gameScheduleInfoList: schedules } = JSON.parse(body);
                    weekRef.update(schedules);*/
                    break;
                }
                case 'teamstats': {
                    const { teamStatInfoList: teamStats } = JSON.parse(body);
                    teamStats.forEach(stat => {
                        //const weekRef = ref.child(`${statsPath}/${weekType}/${weekNumber}/${stat.teamId}/team-stats`);
                        const teamStatsRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${stat.scheduleId}/playerTeamstatsData`);
                        teamStatsRef.set(stat);
                    });
                    break;
                }
                case 'defense': {
                    const { playerDefensiveStatInfoList: defensiveStats } = JSON.parse(body);
                    defensiveStats.forEach(stat => {
                        //const weekRef = ref.child(`${statsPath}/${weekType}/${weekNumber}/${stat.teamId}/player-stats/${stat.rosterId}`);
                        const teamStatsRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${stat.scheduleId}/playerDefenseData`);
                        teamStatsRef.set(stat);
                    });
                    break;
                }
                default: {
                    const property = `player${capitalizeFirstLetter(dataType)}StatInfoList`;
                    const nodeProperty = `player${capitalizeFirstLetter(dataType)}Data`;
                    const stats = JSON.parse(body)[property];
                    stats.forEach(stat => {
                        //const weekRef = ref.child(`${statsPath}/${weekType}/${weekNumber}/${stat.teamId}/player-stats/${stat.rosterId}`);
                        const teamStatsRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${stat.scheduleId}/${nodeProperty}`);
                        teamStatsRef.set(stat);
                    });
                    break;
                }
            }

            res.sendStatus(200);
        });
    }
);

// ROSTERS
app.post('/:username/:platform/:leagueId/freeagents/roster', (req, res) => {
    const db = admin.database();
    const ref = db.ref();
    const {
        params: { username, leagueId, teamId }
    } = req;
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const { rosterInfoList } = JSON.parse(body);
        const dataRef = ref.child(
            `data/${username}/${leagueId}/freeagents`
        );
        const players = {};
        rosterInfoList.forEach(player => {
            players[player.rosterId] = player;
        });
        dataRef.set(players, error => {
            if (error) {
                console.log('Data could not be saved.' + error);
            } else {
                console.log('Data saved successfully.');
            }
        });
        res.sendStatus(200);
    });
});

app.post('/:groupuniqueid/:platform/:leagueId/team/:teamId/roster', (req, res) => {
    const db = admin.database();
    const ref = db.ref();
    const {
        params: { groupuniqueid, leagueId, teamId }
    } = req;
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const { rosterInfoList } = JSON.parse(body);
        const dataRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/teams/${teamId}/rosters`);
        const players = {};
        rosterInfoList.forEach(player => {
            players[player.rosterId] = player;
        });
        dataRef.set(players, error => {
            if (error) {
                console.log('Data could not be saved.' + error);
            } else {
                console.log('Data saved successfully.');
            }
        });
        res.sendStatus(200);
    });
});

app.listen(app.get('port'), () =>
    console.log('Madden Data is running on port', app.get('port'))
);
