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
app.use(cookieParser());
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

app.get("/login",async (req, res) => {
  const user = req.session.user;
  res.render("login", { user, error: null });
});


app.get("/", async (req, res) => {
  const user = req.session.user;


  res.render("index", { user, users: null });
});



app.get("/dashboard",async (req, res) => {

  const user = req.session.user;


  if (!user) {
    res.redirect("/login");
  }

  else {
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
  }
});


//gets another members dashboard
app.get("/viewmembers/:ownersusername", (req, res) => {
  const user = req.session.user;

  const owners_user_name = req.params.ownersusername;


  connection.query(
    `SELECT collection.*, COUNT(likes.collection_id) AS likeCount 
     FROM collection
     JOIN user ON collection.user_id = user.user_id
     LEFT JOIN likes ON collection.collection_id = likes.collection_id
     WHERE user.user_name = ?
     GROUP BY collection.collection_id;`, [owners_user_name],

    (error, collections) => {

      if (error) {
        console.error("Error getting collections", error);
        return res.status(500).json("Error getting collections");
      }


      res.render("viewmembers", { owners_user_name, user, collections });
    }
  );
});






//shows cards from base1
app.get("/cards/:baseId", async (req, res) => {
  const user = req.session.user;
  const baseId = req.params.baseId;

  let showBaseCards = `https://api.tcgdex.net/v2/en/sets/${baseId}`;

  axios.get(showBaseCards).then(result => {

    console.log(result.data);

    let rows = result.data.cards;

    res.render("cards", { baseCards: rows, user });

  });

});

//shows sets
app.get("/sets", async (req, res) => {
  const user = req.session.user;

  const showsets = 'https://api.tcgdex.net/v2/en/sets';

  const setresponse = await axios.get(showsets);

  const sets = setresponse.data;

  res.render("sets", { sets: sets, user })

});


//shows celloection depending on what collection selected
app.get("/collections/:collectionId", async (req, res) => {


  const user = req.session.user;
  let userId = null; 

  if (user) {
    userId = user.user_id;
  }

  const collectionId = req.params.collectionId;

  connection.query(
    `SELECT collection_card.card_id FROM collection_card 
    JOIN collection ON collection.collection_id = collection_card.collection_id 
    WHERE collection.collection_id = ${collectionId};`,

    (error, cards) => {
      if (error) {
        return res.status(500).json("Error fetching card IDs", error);
      }

      const cardIds = cards.map(card => card.card_id);

      const cardDataPromises = cardIds.map(cardId => {
        return axios.get(`https://api.tcgdex.net/v2/en/cards/${cardId}`);
      });

      connection.query(
        `SELECT user_id FROM collection WHERE collection_id = ${collectionId};`,

        (error, userResult) => {
          if (error) {
            console.log("error getting data", error);
          }

          if (userResult.length === 0) {
            console.log("no data retrieved", error);
          }

          const collectionUserId = userResult[0].user_id;

          Promise.all(cardDataPromises)
            .then(cardDataResponses => {
              const cardData = cardDataResponses.map(response => response.data);
              
              res.render("collections", { user, cardData, userId, collectionId, collectionUserId });
            })
            .catch(error => {
              res.status(500).json("error getting card data", error);
            });
        }
      );
    }
  );
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




app.get("/expansions",async (req, res) => {
  const user = req.session.user;
  res.render("expansions", { user });
});

app.get("/newuser",async (req, res) => {
  const user = req.session.user;
  res.render("newuser", { user });
});



app.get("/accountsettings", async (req, res) => {
  const user = req.session.user;
  res.render("accountsettings", { user });
});





//-----------------SQL Queries----------------------------------


//creates account checking for username and email
app.post('/submit', async (req, res) => {
  const { user_name, firstname, lastname, email, password, dob, address, phone } = req.body;


  connection.query('SELECT * FROM user WHERE email_address = ? OR user_name = ?', [email, user_name], 

  (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Problem with server. help :(' });
    }

    if (results.length > 0) {
      return res.send('user already exists');

    }


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



//updates account
app.post('/updateaccount', async (req, res) => {

  const user = req.session.user;

  let user_id = user.user_id;

  console.log(user_id);

  const { user_name, firstname, lastname, email, dob, address, phone } = req.body;


  connection.query('UPDATE user SET user_name = ?, first_name = ?, last_name = ?, email_address = ?, date_of_birth = ?, address = ?, phone_number = ? WHERE user_id = ?', 
                  [user_name, firstname, lastname, email, dob, address, phone, user_id], 
                  (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Problem with server. help :(' });
    }

    res.redirect("/");
  });
});



//deletes account
app.post('/deleteaccount', async (req, res) => {

  const user = req.session.user;
  let user_id = user.user_id;

  const { delete_username, delete_password } = req.body;


  connection.query('SELECT * FROM user WHERE user_name = ? AND password = ?', [delete_username, delete_password], 

  (error, results) => {
    if (error) {

      console.error(error);
      return res.status(500).json({ error: 'Problem with server. help :(' });
    }

    if (results.length === 0) {
      return res.send('incorrect username or password');
    }

    connection.query('DELETE FROM user WHERE user_id = ?', [user_id], (error) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Problem with server. help :(' });
      }

      res.redirect("/");
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


app.post('/deletecard/:collectionId/:cardId', (req, res) => {
  const { collectionId, cardId } = req.params;

  connection.query(
    `DELETE FROM collection_card WHERE collection_id = ? AND card_id = ?`, 

    [collectionId, cardId],
    (error) => {
      if (error) {
        console.error("problem deleting card", error);
      }
      return res.redirect("/dashboard");
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


//members search bar
app.get('/memberSearch', async (req, res) => {

  const user = req.session.user;

  let searchparameter = req.query.searchInput;


  connection.query(`SELECT user_name FROM user
  WHERE user_name LIKE '%${searchparameter}%';`, (error, result) => {

    if (error) {
      console.error("search failed");
    }
    const users = result;
    console.log(users);


    res.render("index", { user, users });

  });

});



app.post("/like-collection/:collectionId", async (req, res) => {

  const user = req.session.user;
  const collectionId = req.params.collectionId;

  const userId = user.user_id;

  connection.query(
    `SELECT * FROM likes WHERE user_id = ? AND collection_id = ?`,  [userId, collectionId],

    (error, results) => {

      if (error) {

        console.error("Error in check", error);
      }

      if (results.length > 0) {
        console.error("Already liked collection");

      }

      connection.query(
        `INSERT INTO likes (user_id, collection_id) VALUES (?, ?)`, [userId, collectionId],
        (error) => {

          if (error) {

            console.error("Could not like collection", error);
          }

          connection.query(
            `SELECT user.user_name FROM collection 
             JOIN user ON collection.user_id = user.user_id
             WHERE collection.collection_id = ?`, [collectionId],

            (error, result) => {
              if (error) {

                console.error("cannot find username", error);

              }

              if (result.length === 0) {
                console.error("cannot find owner");

              }

              const ownerUsername = result[0].user_name;

              res.redirect(`/viewmembers/${ownerUsername}`);
            }
          );
        }
      );
    }
  );
});

