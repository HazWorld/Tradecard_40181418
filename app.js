//const { error } = require("console");

const express = require("express");
const connection = require("./connection");
const path = require("path");
const app = express();
const cookieParser = require('cookie-parser')
const session = require('express-session')
const axios = require('axios');

const PORT = 3000;

const halfDay = 1000 * 60 * 60 * 12;


app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, `./public`)));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({

  secret: "mysecretkey",
  saveUninitialized: true,
  cookie: { maxAge: halfDay },
  resave: false

}));


//listening on the port set above
app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});



app.get("/", (req, res) => {
  const user = req.session.user;


  res.render("index", { user });
});



app.get("/dashboard", (req, res) => {

  const user = req.session.user;

  if (req.session.user) {

    const user_name = user.user_name;

    connection.query(`SELECT collection.* FROM collection
    JOIN user ON collection.user_id = user.user_id
    WHERE user.user_name = '${user_name}';`, 
  
    (error, collections) => {

      if (error) {
        console.error("error getting collections", error);
        return res.status(500).json("error getting collections");
      }

      res.render("dashboard", { user_name, user, collections });
    });
  } else {
    res.redirect("/login");
  }

});


//shows cards from base1
app.get("/cards", async (req, res) => {
  const user = req.session.user;

  let showBaseCards = 'https://api.tcgdex.net/v2/en/sets/base1';

  axios.get(showBaseCards).then(result => {

    console.log(result.data);

    let rows = result.data.cards;

    res.render("cards", { baseCards: rows, user });

  });

});


app.get("/viewcard/:cardId", async (req, res) => {
  const user = req.session.user;
  const cardId = req.params.cardId;

  let cardInfo = `https://api.tcgdex.net/v2/en/cards/${cardId}`;


  const result = await axios.get(cardInfo);

  let cardData = result.data;

  connection.query(
    `SELECT * FROM collection WHERE user_id = ${user ? user.user_id : null}`,
    (error, collections) => {
      if (error) {
        console.error("cannot get collecitons", error);
      }

      console.log(result.data);
      res.render("viewcard", { card: cardData, user, collections });
    }
  )



});

//shows celloection depending on what collection selected
app.get("/collections/:collectionId", async (req, res) => {
  const user = req.session.user;

  
  const collectionId = req.params.collectionId;
  const userId = user.user_id;
   

  connection.query(
    `SELECT collection_card.card_id FROM collection_card 
    JOIN collection ON collection.collection_id = collection_card.collection_id 
    WHERE collection.user_id = ${userId} AND collection.collection_id = ${collectionId};`, 
    (error, cards) => {

      if (error){
        return res.status(500).json("Error fetching card IDs", error);
      }

      const cardIds = cards.map(card => card.card_id);

      const cardDataPromises = cardIds.map(cardId => {

        return axios.get(`https://api.tcgdex.net/v2/en/cards/${cardId}`);
      });

      Promise.all(cardDataPromises).then(cardDataResponses => {

          const cardData = cardDataResponses.map(response => response.data);

          
          res.render("collections", { user, cardData });

      });

    });

  
});




app.get("/expansions", (req, res) => {
  const user = req.session.user;
  res.render("expansions", { user });
});

app.get("/newuser", (req, res) => {
  const user = req.session.user;
  res.render("newuser", { user });
});


app.get("/login", (req, res) => {
  const user = req.session.user;
  res.render("login", { user, error: null });
});



//-----------------SQL Queries----------------------------------


//adding a new user to the database while checking for preexisting emails
app.post('/submit', async (req, res) => {
  const { user_name, firstname, lastname, email, password, dob, address, phone } = req.body;


  //checking if user exists
  connection.query('SELECT * FROM user WHERE email_address = ?', [email], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Problem with server. help :(' });
    }

    if (results.length > 0) {
      return res.send('user already exists');

    }

    //insert new user into datbase
    const values = [user_name, firstname, lastname, email, password, dob, address, phone];

    connection.query('INSERT INTO user (user_name, first_name, last_name, email_address, password, date_of_birth, address, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', values, (error) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Problem with server. help :(' });
      }

      res.redirect("/login");


    });
  });
});



//signs in users
app.post('/signin', async (req, res) => {

  const { user_name, password } = req.body;

  connection.query('SELECT * FROM user WHERE user_name = ? AND password = ?', [user_name, password], (error, results) => {

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Problem with server. help :(' });
    }

    if (results.length === 0) {
      return res.render('login', { error: 'Invalid username or password', user: null });
    }


    req.session.user = results[0];
    res.redirect("/dashboard");
  });

});

//creates a new collection
app.post('/createcollection', async (req, res) => {

  const user = req.session.user;
  const { collectionName } = req.body;

  if (!user) {
    return res.redirect("/login");
  }


  if (!collectionName) {
    return res.status(400).json("Please insert a name for your collection.");
  }

  const userId = user.user_id;


  connection.query(
    "INSERT INTO collection (collection_name, user_id) VALUES (?, ?)",
    [collectionName, userId],
    (error, result) => {
      if (error) {
        console.error("Error creating collection", error);
        return res.status(500).json("Error creating collection");
      }
      res.redirect('/dashboard');
    }

  );

});



//adding a card to a collection
app.post('/addcard', (req, res) => {
  const user = req.session.user;

  const { cardId, collectionName } = req.body;



  connection.query(
    "SELECT collection_id FROM collection WHERE collection_name = ?", [collectionName],
    (error, results) => {
      if (error) {
        console.error("Error retrieving collection ID", error);
        return res.status(500).json("Error retrieving collection ID");
      }
      if (results.length === 0) {
        return res.status(500).json("no collection found");
      }

      const collection_id = results[0].collection_id;

      connection.query('INSERT INTO collection_card (card_id, collection_id) VALUES (?,?)', [cardId, collection_id], (error, results) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'Problem with server. help :(' });
        }

        return res.redirect('/dashboard');

      });
    }

  );
});


//logs out user
app.get('/logout', (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Problem with server. help :(' });
    }

    res.redirect('/');

  });


});

//searching for a card through api
app.get('/indexsearch', async (req, res) => {

  const user = req.session.user;

  try {

    let searchparameter = req.query.searchInput;


    const apicardsearch = `https://api.tcgdex.net/v2/en/cards/${searchparameter}`;

    const result = await axios.get(apicardsearch);

    let cardData = result.data;

    console.log(cardData);

    connection.query(
      `SELECT * FROM collection WHERE user_id = ${user ? user.user_id : null}`,
      (error, collections) => {
        if (error) {
          console.error("cannot get collecitons", error);
        }

        console.log(result.data);
        res.render("viewcard", { card: cardData, user, collections });
      }
    )


  } catch (error) {

    console.error("error getting card data:", error);

    res.redirect('/');

  }

});



