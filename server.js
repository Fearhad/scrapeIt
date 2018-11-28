var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
const path = require('path');
// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");
var fs = require('fs');
var db = require("./models");

var port = process.env.PORT || 8080;

var app = express();

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://heroku_xqqz7v0d:piru5mhsonff175ib8fm4eumdk@ds041387.mlab.com:41387/heroku_xqqz7v0d";

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({
  extended: true
}));
app.use(express.json());
// Make Public a static folder

// Connect to the Mongo DB
mongoose.connect(MONGODB_URI);

app.use(express.static(path.join(__dirname, 'Public')));

app.get('/', function(req, res) {
  fs.readdir(path.join(__dirname), function(err, items) {
    console.log(items);
  
    for (var i=0; i<items.length; i++) {
        console.log(items[i]);
    }
  });
  res.sendfile(path.resolve(__dirname, 'Public', 'index.html'));
});

app.get("/test", function (req,res) {
  fs.readdir(path.join(__dirname, 'Public'), function(err, items) {
    console.log(items);
  
    for (var i=0; i<items.length; i++) {
        console.log(items[i]);
    }
  });
  res.sendFile(path.join(__dirname,'app','Public/index.html'))
});

// A GET route for scraping the Belleville Intelligencer website
app.get("/scrape", function (req, res) {
  // First, we grab the body of the html with axios
  axios.get("http://www.intelligencer.ca/").then(function (response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    
    // Now, we grab every h4 within an article tag, and do the following:
    $("article h4").each(async function (i, element) {
      // Save an empty result object


      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children("a")
        .text();
      result.link = $(this)
        .children("a")
        .attr("href");

     try{ 
       const article = await db.Article.find({title: result.title})
      if (article.length > 0) {
        console.log("already exists") 
      }else{
      // Create a new Article using the `result` object built from scraping
      const dbArticle = await db.Article.create(result)
      console.log(dbArticle)}
       
      } catch(e){
        console.error(e)
        return res.json(e)
      }
    });

    // If we were able to successfully scrape and save an Article, send a message to the client
    res.send("Scrape Complete. YAY.");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(port, function () {
  console.log("App running on port " + port + "!");
});