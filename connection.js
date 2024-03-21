const mysql = require('mysql2');

//creating the connection between database and site
const db = mysql.createConnection({ 
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: 'root',
    database: '40181418'
});

//checking the connection and returning a throwing either a bad error to the console or a good connection message
db.connect((err) => {
    if(err){
        console.error("cannot connect to database");
        return;
    }else{
        console.log("connection to database successful");
    }
});

module.exports = db;