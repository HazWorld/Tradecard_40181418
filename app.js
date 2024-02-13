//const { error } = require("console");

const express = require("express");
const connection = require("./connection");
const path = require("path");
const app = express();
const PORT = 3000;



app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname,`./public`)));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

 //listening on the port set above
app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});

//gets the path to the index.html homepage
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

app.get("/cards", (req, res) => {
  res.render("cards");
});

app.get("/expansions", (req, res) => {
  res.render("expansions");
});

app.get("/newuser", (req, res) => {
  res.render("newuser");
});

app.get("/signin", (req, res) => {
  res.render("signin");
});

app.get("/newusererr", (req, res) => {
  res.render("newusererr");
});


//-----------------SQL----------------------------------


//adding a new user to the database while checking for preexisting emails
app.post('/submit', async (req, res) => {
    const {user_name, firstname, lastname, email, password, dob, address, phone} = req.body;
  
    // Check if the user already exists
    connection.query('SELECT * FROM user WHERE email_address = ?', [email], (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
  
      if (results.length > 0) {
        return res.redirect('/newusererr');
      }
  
      // If user does not exist, insert the new user
      const sql = 'INSERT INTO user (user_name, first_name, last_name, email_address, password, date_of_birth, address, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      const values = [user_name, firstname, lastname, email, password, dob, address, phone];
      connection.query(sql, values, (error) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        res.redirect("/signin");
        
 
      });
    });
  });

 







