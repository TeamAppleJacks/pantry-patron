const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const express = require('express');

const socket = require('socket.io');

const app = express();
const session = require('express-session');
const path = require('path');

const database = require('../database/index.js');
const User = require('../database/schemas/UserSchema.js');
const utils = require('./utils.js');
const request = require('request');
const config = require('../client/src/config/walmart.js');

// Module constants
const SALT_ROUNDS = 10; // Difficulty  to crack (Incrementing doubles compute time)
const CLIENT_FOLDER = path.join(__dirname, '../client/dist');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret:
      process.env.SESSION_SECRET || '0979zx7v6vvq0398ubvq7w6dc8c7z5rvg7i1',
    cookie: {},
    resave: true,
    saveUninitialized: true,
  }),);

// Handle static endpoints
const allPublicEndpoints = ['/login', '/register'];
const allPrivateEndpoints = ['/', '/lists'];

function serveStatic(endpoint, authorizeCallback = (req, res, next) => next()) {
  app.get(endpoint, authorizeCallback, (req, res) =>
    res.sendFile(path.join(CLIENT_FOLDER, 'index.html')),);
}

allPublicEndpoints.forEach(endpoint => serveStatic(endpoint));
allPrivateEndpoints.forEach(endpoint =>
  serveStatic(endpoint, utils.checkLoggedIn),);

// Make all files in dist public (Must be after setting static endpoints)
app.use(express.static(CLIENT_FOLDER));

// All public API calls
app.get('/', utils.checkLoggedIn, (req, res) => {
  res.end();
});

app.get('/api/walmart', (req, res) => {
  var data = process.env.WALMART_API_KEY || config.WALMART_API_KEY;

  request(`http://api.walmartlabs.com/v1/search?apiKey=${data}&query=${req.query.query}&sort=price&order=asc&numItems=1`, function (error, response, body) {
    res.send(JSON.parse(body));
  });
});

app.get('/api/edamam', (req, res) => {
  var id = process.env.RECIPE_API_ID || config.RECIPE_API_ID;
  var keys = process.env.RECIPE_API_KEYS || config.RECIPE_API_KEYS

  request(`https://api.edamam.com/search?q=${req.query.q}&app_id=${id}&app_key=${keys}&from=0&to=6`, (error, response, body) => {
    res.send(JSON.parse(body));
    console.log('sending back recipe lists!');
  });
});

app.get('/api/edamam/filter', (req, res) => {
  var id = process.env.RECIPELIST_API_ID || config.RECIPELIST_API_ID;
  var keys = process.env.RECIPELIST_API_KEYS || config.RECIPELIST_API_KEYS

  request(`https://api.edamam.com/search?q=${req.query.q}&app_id=${id}&app_key=${keys}&from=0&to=3&calories=${req.query.calories}&diet=${req.query.diet}&health=${req.query.health}`, (error, response, body) => {
    res.send(JSON.parse(body));
    console.log('sending back filtered recipe lists!');
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body; // might only be req.body

  // If user
  if (username && password) {
    const db = User.find({ username }).exec();

    db.then(async (user) => {
      const isValiduser = await bcrypt.compare(password, user[0].hash);
      return {
        user: user[0],
        hash: user[0].hash,
        isValidUser: isValiduser,
      };
    })
      .then(({ user, hash, isValidUser }) => {
        if (!isValidUser) {
          res.end(JSON.stringify({
              loc: '/login',
              message: 'Username and password do not match our records',
            }),);
        }

        req.session.username = username;
        req.session.hash = hash;
        database.searchForListsAndPopulate(user.grocery_lists, (lists) => {
          const results = { loc: '/', lists, userData: user };
          res.end(JSON.stringify(results));
        });
      })
      .catch((err) => {
        if (err) console.error('user does not exist.');
        res.end(JSON.stringify({
            loc: '/register',
            message:
              'The user entered does not have an account with us. Please register to continue',
          }),);
      });
  } else {
    res.end(JSON.stringify({ loc: '/login' }));
  }
});

app.post('/updateHistory', (req, res) => {
  database.searchForItemInHistoryAndPopulate(req.body, true, (historyItem) => {
    res.end(JSON.stringify(historyItem));
  });
});

app.get('/logout', (req, res) => {
  // Remove user
  req.session.destroy();
  res.redirect('/login');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    bcrypt
      .hash(password, SALT_ROUNDS)
      .then(async hash =>
        database.saveUser({
          username,
          hash,
          grocery_list: [],
          last_login: new Date(),
          failed_login_attempts: 0,
        }),)
      .then((hash) => {
        req.session.username = username;
        req.session.hash = hash;

        res.end('/login');
      })
      .catch();
  } else {
    res.end('/register');
  }
});

// searches the database for an item, if it doesn't exists a new item
// will be created
app.post('/search/item', utils.checkLoggedIn, (req, res) => {
  database.searchForItem(req.body, (item) => {
    res.end(JSON.stringify(item));
  });
});

// adds an item to a specified grocerylist then returns
// the list in populated form.
app.post('/addItem', (req, res) => {
  database.searchForItemInHistory(req.body, (updatedList) => {
    database.searchForListsAndPopulate([updatedList._id], (populatedList) => {
      res.end(JSON.stringify(populatedList));
    });
  });
});

app.post('/lists/create', utils.checkLoggedIn, (req, res) => {
  database.createList(req.body, (list) => {
    res.end(JSON.stringify(list));
  });
});

app.post('/updateList', (req, res) => {
  database.updateList(req.body, (updatedList) => {
    res.end(JSON.stringify(updatedList));
  });
});

app.post('/lists/delete', utils.checkLoggedIn, (req, res) => {
  const { _id } = req.body;

  database.deleteListById(_id).then(deletedId => res.send(deletedId));
});

app.get('/store/search', (req, res) => {
  const { name } = req.query;

  const promiseSearch = name
    ? database.storeSearch({ name }).exec()
    : database.storeSearch({}).exec();

  promiseSearch.then(stores => res.end(JSON.stringify(stores)));
});

app.post('/store/create', utils.checkLoggedIn, (req, res) => {
  const { name } = req.body;

  if (!name) {
    res.status(404);
    res.send('Requires name');
    return;
  }

  database
    .storeSave({ name })
    .then((store) => {
      res.end(JSON.stringify(store));
    })
    .catch((err) => {
      res.status(500);
      console.error(
        `Could not create store ${name} in Stores database (Duplicate?)`,
        err,
      );
      res.send('Apologies for this error. From our expreience this occurs when the store name is a duplicate. We advise checking the store name.',);
    });
});

app.post('/search/users', (req, res) => {
  database.searchUser(req.body).exec((err, user) => {
    if (user) {
      res.end(JSON.stringify({ message: 'username already exists', error: true }),);
    } else {
      res.end(JSON.stringify({ message: 'Username is available', error: false }),);
    }
  });
});

// Initialization
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});


// socket.io
const io = socket(server);

io.on('connection', (socket) => {
  console.log(socket.id);

  socket.on('sendMsg', (data) => {
    io.emit('receivedMsg', data);
  });
});
