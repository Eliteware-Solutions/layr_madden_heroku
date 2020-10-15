const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const mkdirp = require('mkdirp');
const getDirName = require('path').dirname;

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

/*app.get('*', (req, res) => {
    res.send('Madden Companion Exporter');
});*/

// res.write(JSON.stringify(JSON.parse(body)));
// res.end();

app.post('/create_file/:groupid/:platform/:leagueId/*', (req, res) => {
    const db = admin.database();
    const ref = db.ref();
    const originalUrl = req.originalUrl;
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const {params: { groupid, leagueId }} = req;
        const UrlAry = originalUrl.split(`${leagueId}/`);
        const pageAry = UrlAry[1].split('/');
        const pageName = pageAry[pageAry.length - 1];
        const pageIndex = pageAry.indexOf(pageName);
        let path = "madden";
        if (!fs.existsSync(path)){
            fs.mkdirSync(path);
        }
        if (!fs.existsSync("madden")){
            fs.mkdirSync("madden");
        }
        if (pageIndex > -1) {
            pageAry.splice(pageIndex, 1);
            for(var i=0; i < pageAry.length; i++) {
                if (!fs.existsSync(pageAry[i])){
                    fs.mkdirSync(pageAry[i]);
                }
            }
        }
        const pagePath = `madden/${leagueId}/`+pageAry.join("/");

        //let newexport= `||${leagueId}-${groupid}`;
        //fs.writeFileSync('madden/export.txt', newexport);
        /*if (!fs.existsSync("madden/week")){
            fs.mkdirSync("madden/week");
        }*/

        res.sendStatus(200);
    });
});

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

        /* Store loading flag in FireBase */
        const loadingRef = ref.child(`exportData/${groupuniqueid}/${leagueId}`);
        loadingRef.update({'loading': "false"});

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
        let calendarYear = "";
        /* Store loading flag in FireBase */
        const loadingRef = ref.child(`exportData/${groupuniqueid}/${leagueId}`);
        loadingRef.update({'loading': "false"});

        teams.forEach(team => {
            if (calendarYear != "") {
                calendarYear = team.calendarYear;
            }
            const standingRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/standings/${team.calendarYear}/${team.teamId}`);
            const teamRef = ref.child(`exportData/${groupuniqueid}/${leagueId}/teams/${team.teamId}`);
            standingRef.update(team);
            teamRef.set(team);
        });
        /* Store Calendar Year in FireBase */
        const calYearRef = ref.child(`exportData/${groupuniqueid}/${leagueId}`);
        calYearRef.update({'calendarYear': calendarYear});

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

            /* Store Current Week Index in FireBase */
            const curWeekIdxRef = ref.child(`exportData/${groupuniqueid}/${leagueId}`);
            curWeekIdxRef.update({'currentWeekIndex': weekTypeNumber});

            /* Store loading flag in FireBase */
            const loadingRef = ref.child(`exportData/${groupuniqueid}/${leagueId}`);
            loadingRef.update({'loading': "false"});

            switch (dataType) {
                case 'schedules': {
                    const { gameScheduleInfoList: schedules } = JSON.parse(body);
                    schedules.forEach(schedule => {
                        const scheduleRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${schedule.scheduleId}`);
                        scheduleRef.set(schedule);
                    });
                    break;
                }
                case 'teamstats': {
                    const { teamStatInfoList: teamStats } = JSON.parse(body);
                    teamStats.forEach(stat => {
                        const teamStatsRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${stat.scheduleId}/playerTeamstatsData/${stat.teamId}`);
                        teamStatsRef.set(stat);
                    });
                    break;
                }
                case 'defense': {
                    const { playerDefensiveStatInfoList: defensiveStats } = JSON.parse(body);
                    defensiveStats.forEach(stat => {
                        const teamStatsRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${stat.scheduleId}/playerDefenseData/${stat.rosterId}`);
                        teamStatsRef.set(stat);
                    });
                    break;
                }
                default: {
                    const property = `player${capitalizeFirstLetter(dataType)}StatInfoList`;
                    const nodeProperty = `player${capitalizeFirstLetter(dataType)}Data`;
                    const stats = JSON.parse(body)[property];
                    stats.forEach(stat => {
                        const teamOtherRef = ref.child(`${basePath}schedules/${weekTypeName}/${weekTypeNumber}/${stat.scheduleId}/${nodeProperty}/${stat.rosterId}`);
                        teamOtherRef.set(stat);
                    });
                    break;
                }
            }

            res.sendStatus(200);
        });
    }
);

// ROSTERS
/*app.post('/:username/:platform/:leagueId/freeagents/roster', (req, res) => {
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
        const dataRef = ref.child(`data/${username}/${leagueId}/freeagents`);
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
});*/

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

        /* Store loading flag in FireBase */
        const loadingRef = ref.child(`exportData/${groupuniqueid}/${leagueId}`);
        loadingRef.update({'loading': "false"});

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

//get all users
app.get('/export_data', async (req, res) => {
    let tempExportAry = [];
    let tempGroupAry = [];
    let tempGameAry = [];
    const db = admin.database();
    const refChange = db.ref(); // Update Arrange data
    const refExport = db.ref("exportData"); // Get to Arrange
    refExport.once("value").then(function(snapshot) {
        snapshot.forEach(function (childSnapshot) {
            var obj = {};
            var groupkey = childSnapshot.key;
            var calendarYear = "";

            childSnapshot.forEach(function (childValue) {
                let standingTeam = {};
                tempGameAry.push(childValue.key);
                var leaguekey = childValue.key;
                var childData = childValue.val();
                calendarYear = childData.calendarYear;
                var teams = childData.teams;

                // =============== Arrange Standings Team data ===============
                var standings = childData.standings[calendarYear];
                for(let [key, value] of Object.entries(childData.leagueTeams)){
                    var teamLogoUrl = "asset/nfl_team_logos/"+value.displayName.toLowerCase();
                    teams[key]['logo'] = teamLogoUrl;
                    value.teamLogo = teamLogoUrl;
                    standingTeam[key] = Object.assign(standings[key], value);
                }
                const standingRef = refChange.child(`exportData/${groupkey}/${leaguekey}/standings/${calendarYear}`);
                standingRef.set(standingTeam);
                // =============== Ends ===============
                // =============== Arrange Team data ===============
                const teamRef = refChange.child(`exportData/${groupkey}/${leaguekey}/teams`);
                teamRef.set(teams);
                // =============== Ends ===============
            });

            obj[groupkey] = childSnapshot.val();
            tempExportAry.push(obj);
            tempGroupAry.push(groupkey);
        });
        res.send(tempExportAry);
    });
});

app.listen(app.get('port'), () =>
    console.log('Madden Data is running on port', app.get('port'))
);
