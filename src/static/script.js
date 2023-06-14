import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, get, off } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";;

//Firebase constants
// const firebaseConfig = {
//     apiKey: "AIzaSyBOZzyu09N3Ye9uVxEs3AxVYjYC8pRjTbs",
//     authDomain: "myvt-c3e73.firebaseapp.com",
//     databaseURL: "https://myvt-c3e73-default-rtdb.asia-southeast1.firebasedatabase.app",
//     projectId: "myvt-c3e73",
//     storageBucket: "myvt-c3e73.appspot.com",
//     messagingSenderId: "863063453367",
//     appId: "1:863063453367:web:cb63a4911dfb882c52a732"
// };

const firebaseConfig = {
    apiKey: "AIzaSyBAmmUZHDFdpzl5ecgXew8UWDPgmXSnUeM",
    authDomain: "vitaltrack-f663f.firebaseapp.com",
    databaseURL: "https://vitaltrack-f663f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "vitaltrack-f663f",
    storageBucket: "vitaltrack-f663f.appspot.com",
    messagingSenderId: "187492578484",
    appId: "1:187492578484:web:8bd334ff5e9e374cc6d3e1",
    measurementId: "G-D5WX7LLMBV"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const root = ref(database, "/Records");
const last = ref(database, "/Records/Last");
const userList = ref(database, "/Users");

let susTemp = [];
let susHR = [];
let valid = [];

// Plotly constants
// TODO: Improve plot
let layout = {
    yaxis: {
        range: [0, 100],
        fixedrange: true
    }
};

// Variables for means
let weeklyStats = {
    "Temp": {
        "sum": 0,
        "count": 0
    },
    "SpO2": {
        "sum": 0,
        "count": 0
    }
};

let monthlyStats = {...weeklyStats};
let users = [];
let end = {"Temp": "°C", "SpO2": "%"};

let tempHigh = 37.9;
let HRLow = 80;

function populatePlot(obj){
    let data = [{
        x: obj.map((g) => new Date(g["Timestamp"])),
        y: obj.map((g) => g[document.querySelector("#vital-signs").value]),
        mode: 'lines+markers',
        line: {color: '#80CAF6'},
        marker: {color: obj.map((g) => {
            if(document.querySelector("#vital-signs").value === "Temp"){
                if(g["Temp"] >= tempHigh) return "#f00e0e"
                else return "#2ae012"
            }
            else{
                if(g["SpO2"] <= HRLow) return "#f00e0e"
                else return "#2ae012"
            }
        })}
    }]

    Plotly.react('graph', data, layout);
}

function extendPlot(obj){
    let time = new Date(obj["Timestamp"]);
    
    let update = {
        x:  [[ time ]],
        y:  [[obj[document.querySelector("#vital-signs").value]]],
        'marker.color': [[(function () {
            if(document.querySelector("#vital-signs").value === "Temp"){
                if(obj["Temp"] >= tempHigh) return "#f00e0e"
                else return "#2ae012"
            }
            else{
                if(obj["SpO2"] <= HRLow) return "#f00e0e"
                else return "#2ae012"
            }
        })()]]
    }

    let olderTime = time.setMinutes(time.getMinutes() - 1);
    let futureTime = time.setMinutes(time.getMinutes() + 1);
    let minuteView = {
        xaxis: {
            type: 'date',
            range: [olderTime,futureTime]
        }
    };

    Plotly.relayout('graph', minuteView);
    Plotly.extendTraces('graph', update, [0])
}

function getAverage(obj){
    //Filter valid
    obj.splice(-1);
    let now = new Date();
    let statsForWeek = obj.filter(x => now - new Date(x["Timestamp"]) <= 604800000);
    let statsForMonth = obj.filter(x => now - new Date(x["Timestamp"]) <= 2592000000);

    //Sum
    weeklyStats["Temp"]["sum"] = statsForWeek.map(x => x["Temp"]).reduce((a,b) => a + b, 0);
    weeklyStats["Temp"]["count"] = statsForWeek.length;
    weeklyStats["SpO2"]["sum"] = statsForWeek.map(x => x["SpO2"]).reduce((a,b) => a + b, 0);
    weeklyStats["SpO2"]["count"] = statsForWeek.length;

    monthlyStats["Temp"]["sum"] = statsForMonth.map(x => x["Temp"]).reduce((a,b) => a + b, 0);
    monthlyStats["Temp"]["count"] = statsForMonth.length;
    monthlyStats["SpO2"]["sum"] = statsForMonth.map(x => x["SpO2"]).reduce((a,b) => a + b, 0);
    monthlyStats["SpO2"]["count"] = statsForMonth.length;
}

function updateAverage(obj){
    weeklyStats["Temp"]["sum"] += obj["Temp"];
    weeklyStats["Temp"]["count"]++;
    weeklyStats["SpO2"]["sum"] += obj["SpO2"];
    weeklyStats["SpO2"]["count"]++;

    monthlyStats["Temp"]["sum"] += obj["Temp"];
    monthlyStats["Temp"]["count"]++;
    monthlyStats["SpO2"]["sum"] += obj["SpO2"];
    monthlyStats["SpO2"]["count"]++;
}

function showAverage(){
    let scope = document.querySelector("#stats").value;
    let vital = document.querySelector("#vital-signs").value;
    let mean = document.querySelector("#mean");

    if(scope === "weekly"){
        mean.textContent = weeklyStats[vital]["count"] !== 0 ? (weeklyStats[vital]["sum"] / weeklyStats[vital]["count"]).toPrecision(4) + end[vital] : "-";
    }
    else{
        mean.textContent = monthlyStats[vital]["count"] !== 0 ? (monthlyStats[vital]["sum"] / monthlyStats[vital]["count"]).toPrecision(4) + end[vital] : "-";
    }
}

function getUsers(obj){
    obj.forEach(x => {
        if(x["Temp"] >= tempHigh){
            if(!(susTemp.includes(x["UID"]))){
                susTemp.push(x["UID"]);
            }
        }
    
        if(x["SpO2"] <= HRLow){
            if(!(susHR.includes(x["UID"]))){
                susHR.push(x["UID"]);
            }
        }

        if(users.includes(x["UID"])){
            return;
        }
        else{
            users.push(x["UID"])
        }
    });
}

function updateUsers(obj){
    if(obj["Temp"] >= tempHigh){
        if(!(susTemp.includes(obj["UID"]))){
            susTemp.push(obj["UID"]);
        }
    }

    if(obj["SpO2"] <= HRLow){
        if(!(susHR.includes(obj["UID"]))){
            susHR.push(obj["UID"]);
        }
    }

    if(users.includes(obj["UID"])){
        return;
    }
    else{
        users.push(obj["UID"])
    }
}

function showUsers(){
    let headcount = document.querySelector("#headcount");
    headcount.textContent = users.length.toString();

    if(document.querySelector("#vital-signs").value === "Temp"){
        document.querySelector("#susCount").textContent = susTemp.length.toString();
    }
    else{
        document.querySelector("#susCount").textContent = susHR.length.toString();
    }
}

async function getData(){
    // Initialize plot
    let data1 = [{
        x: [],
        y: [],
        mode: 'lines+markers',
        line: {color: '#80CAF6'},
        marker: {color: []},
    }]
    Plotly.newPlot('graph', data1, layout);

    //Reset stats
    weeklyStats = {
        "Temp": {
            "sum": 0,
            "count": 0
        },
        "SpO2": {
            "sum": 0,
            "count": 0
        }
    };

    monthlyStats = {...weeklyStats};
    users = [];

    // Get user mappings
    await get(userList)
    .then((snapshot) => {
        if (snapshot.exists()) {
            valid = Object.keys(snapshot.val());
            console.log(valid)
        }
    })
    .catch((error) => {
        console.error(error);
    });

    // Get historical data (if there are any)
    let lastRecord = null;

    let x = await get(root)
    .then((snapshot) => {
        if (snapshot.exists()) {
            lastRecord = snapshot.val()["Last"];
            console.log(snapshot.val())
            return snapshot.val();
        }
        else{
            return {};
        }
    })
    .catch((error) => {
        console.error(error);
    });

    let data = Object.values(x).filter(x => valid.includes(x["UID"]));
    console.log(data);
    populatePlot(data)
    getAverage(data)
    showAverage()
    getUsers(data);
    showUsers();

    // Extend plot for every new data in database
    onValue(last, (snapshot) => {
        const data = snapshot.val();
        if(data === null || JSON.stringify(lastRecord) === JSON.stringify(data)){
            return;
        }

        if(!(valid.includes(data["UID"]))){
            return;
        }

        extendPlot(data);
        updateAverage(data);
        showAverage();
        updateUsers(data);
        showUsers();
    });
}

document.querySelector("#vital-signs").addEventListener("change", async (e) => {
    off(last);
    await getData();
});

document.querySelector("#stats").addEventListener("change", showAverage);

window.addEventListener("load", getData);