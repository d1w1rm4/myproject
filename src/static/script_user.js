import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, get, off } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";;

// Firebase constants
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

// Plotly constants
// TODO: Improve plot
let layoutTemp = {
    yaxis: {
        range: [0, 45],
        fixedrange: true,
        title: "Temperature in Celsius",
    },
    xaxis:{
        title: "Date and time"
    }
};

let layoutHR = {
    yaxis: {
        range: [0, 105],
        fixedrange: true,
        title: "Oxygen Saturation Level",
    },
    xaxis:{
        title: "Date and time"
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
let user = null;
let users = {};
let validSN = {};
let sus = {};
let susTemp = [];
let susHR = [];

let userMapping = {};

let tempHigh = 37.9;
let HRLow = 80;

function populatePlots(obj){
    //For Temp
    let data1 = [{
        x: obj.filter(e => user === null || user === e["StudentNo"]).map((g) => new Date(g["Timestamp"])),
        y: obj.filter(e => user === null || user === e["StudentNo"]).map((g) => g["Temp"]),
        mode: 'lines+markers',
        line: {color: '#80CAF6'},
        marker: {color: obj.filter(e => user === null || user === e["StudentNo"]).map((g) => {
            if(g["Temp"] >= tempHigh) return "#f00e0e"
            else return "#2ae012"
        })}
    }]

    Plotly.react('graph1', data1, layoutTemp);

    //For Heart Rate
    let data2 = [{
        x: obj.filter(e => user === null || user === e["StudentNo"]).map((g) => new Date(g["Timestamp"])),
        y: obj.filter(e => user === null || user === e["StudentNo"]).map((g) => g["SpO2"]),
        mode: 'lines+markers',
        line: {color: '#80CAF6'},
        marker: {color: obj.filter(e => user === null || user === e["StudentNo"]).map((g) => {
            if(g["SpO2"] <= HRLow) return "#f00e0e"
            else return "#2ae012"
        })}
    }]

    Plotly.react('graph2', data2, layoutHR);
}

function extendPlots(obj){
    if(user !== null && user !== obj["StudentNo"]){
        return;
    }

    let time = new Date(obj["Timestamp"]);
    
    // For Temp
    let update1 = {
        x:  [[ time ]],
        y:  [[obj["Temp"]]],
        'marker.color': [[ (function () {
            if(obj["Temp"] >= tempHigh) return "#f00e0e"
            else return "#2ae012"
        })() ]]
    }

    // For heart rate
    let update2 = {
        x:  [[ time ]],
        y:  [[obj["SpO2"]]],
        'marker.color': [[ (function () {
            if(obj["SpO2"] <= HRLow) return "#f00e0e"
            else return "#2ae012"
        })() ]]  
    }

    let olderTime = time.setMinutes(time.getMinutes() - 1);
    let futureTime = time.setMinutes(time.getMinutes() + 1);
    let minuteView = {
        xaxis: {
            type: 'date',
            range: [olderTime,futureTime]
        }
    };

    Plotly.relayout('graph1', minuteView);
    Plotly.extendTraces('graph1', update1, [0])

    Plotly.relayout('graph2', minuteView);
    Plotly.extendTraces('graph2', update2, [0])
}

function getAverage(obj){
    //Filter valid
    obj.splice(-1);
    let now = new Date();
    let statsForWeek = obj.filter(x => now - new Date(x["Timestamp"]) <= 604800000 && (user === null || user === x["StudentNo"]));
    let statsForMonth = obj.filter(x => now - new Date(x["Timestamp"]) <= 2592000000 && (user === null || user === x["StudentNo"]));

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
    if(user !== null && user !== obj["StudentNo"]){
        return;
    }

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
    //For Temp
    let tempScope = document.querySelector("#temp-stats").value;
    let tempMean = document.querySelector("#tempMean");
    let mean = 0;

    if(tempScope === "weekly"){
        mean = weeklyStats["Temp"]["count"] === 0? 0 : (weeklyStats["Temp"]["sum"] / weeklyStats["Temp"]["count"]);
    }
    else{
        mean = monthlyStats["Temp"]["count"] === 0? 0 : (monthlyStats["Temp"]["sum"] / monthlyStats["Temp"]["count"])
    }

    if(mean >= tempHigh){
        tempMean.classList.add("abnormal");
    }
    else{
        tempMean.classList.remove("abnormal");
    }
    tempMean.textContent = mean.toPrecision(4) + "°C";

    //For heart rate
    let HRScope = document.querySelector("#hr-stats").value;
    let HRMean = document.querySelector("#HRMean");

    if(HRScope === "weekly"){
        mean = weeklyStats["SpO2"]["count"] === 0? 0 : (weeklyStats["SpO2"]["sum"] / weeklyStats["SpO2"]["count"]);
    }
    else{
        mean= monthlyStats["SpO2"]["count"] === 0? 0 : (monthlyStats["SpO2"]["sum"] / monthlyStats["SpO2"]["count"]);
    }

    if(mean <= HRLow){
        HRMean.classList.add("abnormal");
    }
    else{
        HRMean.classList.remove("abnormal");
    }
    HRMean.textContent = mean.toPrecision(4) + "%";
}

function getUsers(obj){
    obj.forEach(x => {
        users[x["StudentNo"]] = x;

        if(x["Temp"] >= tempHigh){
            sus[x["StudentNo"]] = x;
            if(!(susTemp.includes(x["StudentNo"]))){
                susTemp.push(x["StudentNo"]);
            }
        }
    
        if(x["SpO2"] <= HRLow){
            sus[x["StudentNo"]] = x;
            if(!(susHR.includes(x["StudentNo"]))){
                susHR.push(x["StudentNo"]);
            }
        }
    });
}

function updateUsers(obj){
    users[obj["StudentNo"]] = obj;

    if(obj["Temp"] >= tempHigh){
        sus[obj["StudentNo"]] = obj;
        if(!(susTemp.includes(obj["StudentNo"]))){
            susTemp.push(obj["StudentNo"]);
        }
    }

    if(obj["SpO2"] <= HRLow){
        sus[obj["StudentNo"]] = obj;
        if(!(susHR.includes(obj["StudentNo"]))){
            susHR.push(obj["StudentNo"]);
        }
    }
}

function showUsers(){
    let headcount = document.querySelectorAll("#headcount");
    if(user === null){
        headcount.forEach(x => x.textContent = Object.keys(users).length.toString());
        document.querySelector("#tempcount").textContent = susTemp.length.toString();
        document.querySelector("#HRcount").textContent = susHR.length.toString();
    }
    else{
        headcount.forEach(x => x.textContent = "-");
        document.querySelector("#tempcount").textContent = "-";
        document.querySelector("#HRcount").textContent = "-";
    }

    while(document.querySelector("#table").childElementCount > 2){
        document.querySelector("#table").removeChild(document.querySelector("#table").lastChild);
    }
    
    if(Object.keys(sus).length > 0){
        document.querySelector("#nodata").style.display = "none";
        for(let x of Object.values(sus)){
            addSus(x);
        }
    }
    else{
        document.querySelector("#nodata").style.display = "block";
    }
}

function addSus(obj){
    let newRow = document.createElement("div");
    newRow.classList.add("row");

    let columns = ["StudentNo", "Name", "Temp", "SpO2", "Timestamp"]

    for(let a = 0; a < 5; a++){
        let newData = document.createElement("div");

        if(a === 2){
            if(obj["Temp"] >= tempHigh){
                newData.classList.add("abnormal")
            }
        }

        if(a === 3){
            if(obj["SpO2"] <= HRLow){
                newData.classList.add("abnormal")
            }
        }
        
        if(a == 2){
            newData.innerHTML = obj[columns[a]] + "°C"; 
        }
        else if(a == 3){
            newData.innerHTML = obj[columns[a]] + "%"; 
        }
        else{
            newData.innerHTML = obj[columns[a]];
        }
        newRow.appendChild(newData);
    }

    document.querySelector("#table").appendChild(newRow);
}

function generateProfile(){
    console.log(user)
    if(user === null){
        document.querySelector("#profile").style.display = "none";
        return;
    }

    document.querySelector("#profile").style.display = "block";
    document.querySelector("#profile").style.height = "300px";
    if(Object.keys(validSN).includes(user)){
        document.querySelector("#nouser").style.display = "none";
        document.querySelector("#user-info").style.display = "flex";

        //generate profile
        document.querySelector("#user-name").textContent = validSN[user];
        document.querySelector("#user-sn").textContent = user;
        document.querySelector("#user-temp").textContent = users[user] ? users[user]["Temp"] + "°C" : "-";
        if(users[user]){
            if(users[user]["Temp"] >= tempHigh){
                document.querySelector("#user-temp").classList.add("abnormal");
            }
            else{
                document.querySelector("#user-temp").classList.remove("abnormal");
            }
        }
        document.querySelector("#user-hr").textContent = users[user] ? users[user]["SpO2"] + "%" : "-";
        if(users[user]){
            if(users[user]["SpO2"] <= HRLow){
                document.querySelector("#user-hr").classList.add("abnormal");
            }
            else{
                document.querySelector("#user-hr").classList.remove("abnormal");
            }
        }
        document.querySelector("#user-dtime").textContent = users[user] ? users[user]["Timestamp"] : "-";
        if(Object.keys(sus).includes(user)){
            document.querySelector("#user-status").classList.add("abnormal");
            document.querySelector("#user-status").textContent = "SUS";
        }
        else{
            document.querySelector("#user-status").classList.remove("abnormal");
            document.querySelector("#user-status").textContent = "OK";
        }
    }
    else{
        document.querySelector("#profile").style.height = "50px";
        document.querySelector("#nouser").style.display = "block";
        document.querySelector("#user-info").style.display = "none";
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

    let data2 = [{
        x: [],
        y: [],
        mode: 'lines+markers',
        line: {color: '#80CAF6'},
        marker: {color: []},
    }]
    Plotly.newPlot('graph1', data1, layoutTemp);
    Plotly.newPlot('graph2', data2, layoutHR);

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
    users = {};

    // Get user mappings
    await get(userList)
    .then((snapshot) => {
        if (snapshot.exists()) {
            userMapping = snapshot.val();
            Object.values(userMapping).map(x => validSN[x["StudentNo"]] = x["Name"]);
            console.log(validSN)
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
            return snapshot.val();
        }
        else{
            return {}
        }
    })
    .catch((error) => {
        console.error(error);
    });

    let data = Object.values(x).filter(x => Object.keys(userMapping).includes(x["UID"])).map(x => Object.assign(x, userMapping[x["UID"]]));
    populatePlots(data)
    getAverage(data)
    showAverage()
    getUsers(data);
    showUsers();
    generateProfile();

    // Extend plot for every new data in database
    onValue(last, (snapshot) => {
        const data = snapshot.val();
        if(data === null || JSON.stringify(lastRecord) === JSON.stringify(data)){
            return;
        }
        //Append data
        if(!(Object.keys(userMapping).includes(data["UID"]))){
            return;
        }
        Object.assign(data, userMapping[data["UID"]]);
        
        extendPlots(data);
        updateAverage(data);
        showAverage();
        updateUsers(data);
        showUsers();
        generateProfile();
    });
}

document.querySelector("#hr-stats").addEventListener("change", showAverage);
document.querySelector("#temp-stats").addEventListener("change", showAverage);

document.querySelector("#keyword").addEventListener("submit", async (e) => {
    e.preventDefault();

    //RESET ALL
    user = e.target.querySelector("input[type=search]").value;
    if(user.length === 0){
        user = null;
    }
    
    //add profile div
    generateProfile();

    if(user !== null){
        document.querySelectorAll("#hcount").forEach(x => x.style.display = "none");
    }
    else{
        document.querySelectorAll("#hcount").forEach(x => x.style.display = "list-item");
    }

    await getData();
})

window.addEventListener("load", getData);

document.querySelector("header button").addEventListener("click", () => {
    window.location.href = "/logout";
})