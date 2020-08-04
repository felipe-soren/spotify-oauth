let express = require("express");
let request = require("request");
let querystring = require("querystring");
require("dotenv").config();
const bodyParser = require("body-parser");
var cors = require("cors");

const api = require("./api");

let app = express();

app.use(cors());
app.use(bodyParser.json());

let redirect_uri = process.env.REDIRECT_URI || "http://localhost:8888/callback";

const generatePlaylist = async (artists, authorization) => {
  api.defaults.headers.common["Authorization"] = `Bearer ${authorization}`;

  const topTracksRequest = artists.map((artistId) =>
    api.get(`artists/${artistId}/top-tracks?country=BR`)
  );

  const topTracksResponses = await Promise.all(topTracksRequest);

  const tracksArray = topTracksResponses.map((topTracksResponse) => {
    return topTracksResponse.data.tracks.map((track) => {
      return track.uri;
    });
  });

  const userInfoResponse = await api.get("me");

  const userId = userInfoResponse.data.id;

  const playlistResponse = await api.post(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      name: "Playlist Gerada automaticamente",
      public: "false",
      collaborative: false,
      description: "Playlist Gerada automaticamente",
    }
  );

  const insetTracksInPlayListResponse = await api.post(
    `users/${userId}/playlists/${playlistResponse.data.id}/tracks`,
    {
      uris: tracksArray.flat(),
    }
  );

  return playlistResponse.data;
};

app.post("/playlist", async (req, res) => {
  const { artists } = req.body;
  const { authorization } = req.headers;

  try {
    const data = await generatePlaylist(artists, authorization);
    res.json(data);
  } catch (error) {
    res.status(500);
  }
});

app.get("/artist", async (req, res) => {
  const { authorization } = req.headers;

  try {
    api.defaults.headers.common["Authorization"] = `Bearer ${authorization}`;

    const { name } = req.query;

    const { data } = await api.get(
      `https://api.spotify.com/v1/search?q=${name}&type=artist`
    );

    res.json({ data });
  } catch (error) {
    res.status(500);
    res.render(error);
  }
});

app.get("/login", function (req, res) {
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope:
          "user-read-private user-read-email playlist-modify-public playlist-modify-private",
        redirect_uri,
      })
  );
});

app.get("/callback", function (req, res) {
  let code = req.query.code || null;
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri,
      grant_type: "authorization_code",
    },
    headers: {
      Authorization:
        "Basic " +
        new Buffer(
          process.env.SPOTIFY_CLIENT_ID +
            ":" +
            process.env.SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
    },
    json: true,
  };
  request.post(authOptions, function (error, response, body) {
    var access_token = body.access_token;
    let uri = process.env.FRONTEND_URI || "http://localhost:3000";
    res.redirect(uri + "/login/" + access_token);
  });
});

let port = process.env.PORT || 8888;
console.log(`Listening on port ${port}.`);
app.listen(port);
