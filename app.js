//const { error } = require("console");

const express = require("express");
const connection = require("./connection");
const path = require("path");
const app = express();
const cookieParser = require('cookie-parser')
const session = require('express-session')
let axios = require('axios');
const PORT = 3000;

const halfDay = 1000*60*60*12;

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname,`./public`)));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(session({

  secret: "mysecretkey",
  saveUninitialized: true,
  cookie: { maxAge: halfDay},
  resave: false

}));


 //listening on the port set above
app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});




//gets the path to the index.html homepage
app.get("/", (req, res) => {
    res.render("index");
});



app.get("/dashboard", (req, res) => {
  if(req.session.user){

    const user_name = req.session.user.user_name;
    
    res.render("dashboard", {user_name});
  } else {
    res.redirect("/login")
  }
});



app.get("/cards",async (req, res) => {

  let showBaseCards = 'https://api.tcgdex.net/v2/en/sets/base1';

  axios.get(showBaseCards).then(result => {

    console.log(result.data);
    
    let rows = result.data.cards;

    res.render("cards", {baseCards : rows});

  });

  


});

app.get("/expansions", (req, res) => {
  res.render("expansions");
});

app.get("/newuser", (req, res) => {
  res.render("newuser");
});


app.get("/login", (req, res) => {

  res.render("login");
});



//-----------------SQL----------------------------------


//adding a new user to the database while checking for preexisting emails
app.post('/submit', async (req, res) => {
    const {user_name, firstname, lastname, email, password, dob, address, phone} = req.body;
  
    // Check if the user already exists
    connection.query('SELECT * FROM user WHERE email_address = ?', [email], (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Problem with server. help :(' });
      }
  
      if (results.length > 0) {
        return res.send('user already exists');
      }
  
      // If user does not exist, insert the new user
      const sql = 'INSERT INTO user (user_name, first_name, last_name, email_address, password, date_of_birth, address, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      const values = [user_name, firstname, lastname, email, password, dob, address, phone];
      connection.query(sql, values, (error) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        res.redirect("/login");
        
 
      });
    });
  });


  app.post('/signin', async (req,res) => {

    const {user_name, password } = req.body;

    connection.query('SELECT * FROM user WHERE user_name = ? AND password = ?', [user_name, password], (error, results) => {

      if (error) {
          console.error(error);
          return res.status(500).json({ error: 'Problem with server. help :(' });
      }

      if (results.length === 0) {
          return res.send('Invalid username or password');
      }

      
      req.session.user = results[0];
      res.redirect("/dashboard");
    });

  });

 







