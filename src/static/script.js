import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, get, off } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";;

// Firebase constants
const firebaseConfig = {
    apiKey: "AIzaSyBOZzyu09N3Ye9uVxEs3AxVYjYC8pRjTbs",
    authDomain: "myvt-c3e73.firebaseapp.com",
    databaseURL: "https://myvt-c3e73-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myvt-c3e73",
    storageBucket: "myvt-c3e73.appspot.com",
    messagingSenderId: "863063453367",
    appId: "1:863063453367:web:cb63a4911dfb882c52a732"
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const root = ref(database);
const last = ref(database, "/Record");

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
    "Temperature": {
        "sum": 0,
        "count": 0
    },
    "HeartRate": {
        "sum": 0,
        "count": 0
    }
};

let monthlyStats = {...weeklyStats};

function populatePlot(obj){
    let data = [{
        x: obj.map((g) => new Date(g["DateTime"])),
        y: obj.map((g) => g[document.querySelector("#vital-signs").value]),
        mode: 'lines+markers',
        line: {color: '#80CAF6'}
    }]

    Plotly.react('graph', data, layout);
}

function extendPlot(obj){
    let time = new Date(obj["DateTime"]);
    
    let update = {
        x:  [[ time ]],
        y:  [[obj[document.querySelector("#vital-signs").value]]],
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
    let statsForWeek = obj.filter(x => now - new Date(x["DateTime"]) <= 604800000);
    let statsForMonth = obj.filter(x => now - new Date(x["DateTime"]) <= 2592000000);

    //Sum
    weeklyStats["Temperature"]["sum"] = statsForWeek.map(x => x["Temperature"]).reduce((a,b) => a + b, 0);
    weeklyStats["Temperature"]["count"] = statsForWeek.length;
    weeklyStats["HeartRate"]["sum"] = statsForWeek.map(x => x["HeartRate"]).reduce((a,b) => a + b, 0);
    weeklyStats["HeartRate"]["count"] = statsForWeek.length;

    monthlyStats["Temperature"]["sum"] = statsForMonth.map(x => x["Temperature"]).reduce((a,b) => a + b, 0);
    monthlyStats["Temperature"]["count"] = statsForMonth.length;
    monthlyStats["HeartRate"]["sum"] = statsForMonth.map(x => x["HeartRate"]).reduce((a,b) => a + b, 0);
    monthlyStats["HeartRate"]["count"] = statsForMonth.length;
}

function updateAverage(obj){
    weeklyStats["Temperature"]["sum"] += obj["Temperature"];
    weeklyStats["Temperature"]["count"]++;
    weeklyStats["HeartRate"]["sum"] += obj["HeartRate"];
    weeklyStats["HeartRate"]["count"]++;

    monthlyStats["Temperature"]["sum"] += obj["Temperature"];
    monthlyStats["Temperature"]["count"]++;
    monthlyStats["HeartRate"]["sum"] += obj["HeartRate"];
    monthlyStats["HeartRate"]["count"]++;
}

function showAverage(){
    let scope = document.querySelector("#stats").value;
    let vital = document.querySelector("#vital-signs").value;
    let mean = document.querySelector("#mean");

    if(scope === "weekly"){
        mean.textContent = (weeklyStats[vital]["sum"] / weeklyStats[vital]["count"]).toPrecision(4);
    }
    else{
        mean.textContent = (monthlyStats[vital]["sum"] / monthlyStats[vital]["count"]).toPrecision(4);
    }
}

async function getData(){
    // Initialize plot
    let data = [{
        x: [],
        y: [],
        mode: 'lines+markers',
        line: {color: '#80CAF6'}
    }]
    Plotly.newPlot('graph', data, layout);

    //Reset stats
    weeklyStats = {
        "Temperature": {
            "sum": 0,
            "count": 0
        },
        "HeartRate": {
            "sum": 0,
            "count": 0
        }
    };

    monthlyStats = {...weeklyStats};

    // Get historical data (if there are any)
    let lastRecord = null;
    await get(root)
    .then((snapshot) => {
        if (snapshot.exists()) {
            lastRecord = snapshot.val()["Record"];
            populatePlot(Object.values(snapshot.val()))
            getAverage(Object.values(snapshot.val()))
            showAverage()
        }
    })
    .catch((error) => {
        console.error(error);
    });

    // Extend plot for every new data in database
    onValue(last, (snapshot) => {
        const data = snapshot.val();
        if(data === null || JSON.stringify(lastRecord) === JSON.stringify(data)){
            return;
        }
        extendPlot(data);
        updateAverage(data);
        showAverage();
    });
}

document.querySelector("#vital-signs").addEventListener("change", async (e) => {
    off(last);
    await getData();
});

document.querySelector("#stats").addEventListener("change", showAverage);

window.addEventListener("load", getData);