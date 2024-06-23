// imported required modules for the server codebase
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { connect } = require("./database/db");
const dotenv = require("dotenv");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const Poll = require("./models/Poll");
const User = require("./models/User");
const cors = require("cors");
const fetch = require("node-fetch");

// dotenv basically loads environment variables from .env file
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// handles CORS, static files, JSON, and URL-encoded data
app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// this helps manages the section
app.use(
  session({
    secret: process.env.MY_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// this imitializes Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// connects to the MongoDB database and starts the server
connect()
  .then(() => {
    startServer();
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1); // Exit the process if connection fails
  });

function startServer() {
  // serializes user into d session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // deserializes user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // configuration for Google OAuth strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              displayName: profile.displayName,
              email: profile.emails[0].value,
            });
          }

          return done(null, user);
        } catch (error) {
          console.error("Google OAuth error:", error);
          return done(error);
        }
      }
    )
  );

  // this route handles Google authentication
  app.post("/auth/google", async (req, res) => {
    const idToken = req.body.idToken;

    try {
      const response = await fetch(
        "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken
      );
      const userInfo = await response.json();

      if (userInfo.email_verified) {
        let user = await User.findOne({ googleId: userInfo.sub });

        if (!user) {
          user = await User.create({
            googleId: userInfo.sub,
            displayName: userInfo.name,
            email: userInfo.email,
          });
        }

        req.login(user, (err) => {
          //throws exceptions
          if (err) {
            console.error("Login error:", err);
            return res
              .status(500)
              .json({ success: false, message: "Internal server error" });
          }
          res.json({ success: true, userId: user.id });
        });
      } else {
        res.json({ success: false, message: "Google authentication failed" });
      }
    } catch (error) {
      console.error("Error validating Google ID token:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // route to initiate Google authentication
  app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  // to redirect user to the homepage after authentication
  function redirectToReturnTo(req, res, next) {
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }

  // google authentication callback route
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    redirectToReturnTo
  );

  // Local login route
  app.post(
    "/login",
    passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/login",
      failureFlash: true,
    })
  );

  // home route, serves index.html in this case if authentication is sccessful, else redirects to login
  app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
      res.sendFile(__dirname + "/public/index.html");
    } else {
      res.redirect("/login");
    }
  });

  // login route, serves login.html
  app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/public/login.html");
  });

  // route which creates a new poll, requires authentication
  app.post("/create-poll", isAuthenticated, async (req, res) => {
    try {
      const { question, options } = req.body;
      const createdBy = req.user.id;

      const poll = await Poll.create({
        question,
        options,
        votes: Array(options.length).fill(0),
        createdBy,
      });

      io.emit("pollCreated", poll); // Emit event to notify clients of new poll
      res.status(201).json({ message: "Poll created successfully", poll });
    } catch (error) {
      console.error("Error creating poll:", error);
      res.status(500).json({ error: "Failed to create poll" });
    }
  });



  // Route to get a specific poll by ID
  app.get("/polls/:id", async (req, res) => {
    try {
      const poll = await Poll.findById(req.params.id);
      if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
      }
      res.json(poll);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Socket.IO event handling for real-time updates
  io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("createPoll", async (data) => {
      try {
        const { question, options, userId } = data;

        const poll = await Poll.create({
          question,
          options,
          votes: Array(options.length).fill(0),
          createdBy: userId,
        });

        io.emit("pollCreated", poll);
      } catch (error) {
        console.error("Error creating poll:", error);
        socket.emit("error", "Failed to create poll. Please try again.");
      }
    });

    socket.on("vote", async (data) => {
      try {
        const { pollId, optionIndex, userId } = data;

        const poll = await Poll.findById(pollId);
        if (!poll) {
          socket.emit("error", "Poll not found");
          return;
        }

        const userVote = poll.votes.find((vote) => vote.userId === userId);
        if (userVote) {
          poll.votes[userVote.optionIndex] -= 1;
        }

        poll.votes[optionIndex] += 1;
        await poll.save();

        io.emit("voteUpdated", poll);
      } catch (error) {
        console.error("Error handling vote:", error);
        socket.emit("error", "Failed to vote. Please try again.");
      }
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected");
    });
  });

  // Starts the server using/on port 3000
  server.listen(3000, () => {
    console.log("Server listening on port 3000");
  });
}

// would have placesd this on a sepearate file, basically checks if a user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}
